"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import {
  assertOrganizationStorageQuota,
  buildOrganizationStoragePath,
  getCurrentOrganizationForUser,
} from "@/lib/organization";
import { attachmentSchema } from "@/lib/schemas";
import {
  assertSafeOrganizationStoragePath,
  getOrganizationEntityFolder,
} from "@/lib/services/organization-files";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AttachmentEntityType } from "@/types/database";

const maxAttachmentSizeBytes = 50 * 1024 * 1024;

export async function prepareAttachmentUploadAction({
  entityType,
  entityId,
  fileName,
  sizeBytes,
}: {
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  sizeBytes: number;
}) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);

  if (!entityId) throw new Error("Selecione um registro para anexar.");
  if (sizeBytes <= 0 || sizeBytes > maxAttachmentSizeBytes) {
    throw new Error("O anexo deve ter ate 50 MB.");
  }

  await assertOrganizationStorageQuota(supabase, organization.id, sizeBytes);

  return {
    bucket: "attachments",
    filePath: buildOrganizationStoragePath({
      organizationId: organization.id,
      folder: getOrganizationEntityFolder(entityType, entityId),
      fileName,
    }),
  };
}

export async function registerAttachmentAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = attachmentSchema.parse(formDataToObject(formData));
  const fileSize = parsed.file_size ?? parsed.size_bytes ?? 0;

  await assertOrganizationStorageQuota(supabase, organization.id, fileSize);

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      ...parsed,
      organization_id: organization.id,
      bucket: parsed.bucket ?? "attachments",
      storage_path: parsed.storage_path ?? parsed.file_path,
      file_size: fileSize,
      uploaded_by: user.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    action: "attachment.uploaded",
    entityType: parsed.entity_type,
    entityId: parsed.entity_id,
    metadata: { attachment_id: data.id, file_name: parsed.file_name },
  });

  revalidatePath("/anexos");
  revalidatePath(`/clientes/${parsed.entity_id}`);
  revalidatePath(`/servicos/${parsed.entity_id}`);
}

export async function getAttachmentSignedUrlAction(id: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);

  const { data: attachment, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("id", id)
    .or(`organization_id.eq.${organization.id},is_global.eq.true`)
    .single();
  if (error) throw new Error(error.message);

  if (attachment.is_global && attachment.storage_path?.startsWith("shared/") !== true) {
    throw new Error("Arquivo global sem caminho compartilhado valido.");
  }

  if (!attachment.is_global) {
    assertSafeOrganizationStoragePath(organization.id, attachment.storage_path ?? attachment.file_path);
  }

  const { data, error: signedError } = await supabase.storage
    .from(attachment.bucket ?? "attachments")
    .createSignedUrl(attachment.storage_path ?? attachment.file_path, 60 * 10);
  if (signedError) throw new Error(signedError.message);
  return data.signedUrl;
}

export async function deleteAttachmentAction(id: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);

  const { data: attachment, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .eq("is_global", false)
    .single();
  if (error) throw new Error(error.message);

  const storagePath = attachment.storage_path ?? attachment.file_path;
  assertSafeOrganizationStoragePath(organization.id, storagePath);

  const { error: storageError } = await supabase.storage
    .from(attachment.bucket ?? "attachments")
    .remove([storagePath]);
  if (storageError) throw new Error(storageError.message);

  const { error: deleteError } = await supabase
    .from("attachments")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization.id)
    .eq("is_global", false);
  if (deleteError) throw new Error(deleteError.message);

  await logAudit(supabase, {
    action: "attachment.deleted",
    entityType: attachment.entity_type,
    entityId: attachment.entity_id,
    metadata: { attachment_id: id, file_name: attachment.file_name },
  });

  revalidatePath("/anexos");
  revalidatePath(`/clientes/${attachment.entity_id}`);
  revalidatePath(`/servicos/${attachment.entity_id}`);
}

export async function updateAttachmentAction(id: string, formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);

  const { data: attachment, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .eq("is_global", false)
    .single();
  if (error) throw new Error(error.message);

  const nextStoragePath = formData.get("storage_path")?.toString() || null;
  const nextFileName = formData.get("file_name")?.toString() || null;
  const nextMimeType = formData.get("mime_type")?.toString() || null;
  const nextSizeBytes = formData.get("size_bytes")?.toString();
  const nextCategory = formData.get("category")?.toString() || null;

  const patch: {
    category: string | null;
    file_path?: string;
    storage_path?: string;
    file_name?: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    file_size?: number | null;
  } = {
    category: nextCategory,
  };

  if (nextStoragePath) {
    assertSafeOrganizationStoragePath(organization.id, nextStoragePath);
    const previousPath = attachment.storage_path ?? attachment.file_path;
    assertSafeOrganizationStoragePath(organization.id, previousPath);

    patch.file_path = nextStoragePath;
    patch.storage_path = nextStoragePath;
    patch.file_name = nextFileName ?? attachment.file_name;
    patch.mime_type = nextMimeType ?? attachment.mime_type;
    patch.size_bytes = nextSizeBytes ? Number(nextSizeBytes) : attachment.size_bytes;
    patch.file_size = nextSizeBytes ? Number(nextSizeBytes) : attachment.file_size;

    const { error: storageError } = await supabase.storage
      .from(attachment.bucket ?? "attachments")
      .remove([previousPath]);
    if (storageError) throw new Error(storageError.message);
  }

  const { error: updateError } = await supabase
    .from("attachments")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", organization.id);
  if (updateError) throw new Error(updateError.message);

  await logAudit(supabase, {
    action: "attachment.updated",
    entityType: attachment.entity_type,
    entityId: attachment.entity_id,
    metadata: { attachment_id: id },
  });

  revalidatePath("/anexos");
  revalidatePath(`/clientes/${attachment.entity_id}`);
  revalidatePath(`/servicos/${attachment.entity_id}`);
}
