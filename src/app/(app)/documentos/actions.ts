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
import { documentTemplateSchema } from "@/lib/schemas";
import { assertSafeOrganizationStoragePath } from "@/lib/services/organization-files";
import { createServerSupabase } from "@/lib/supabase/server";

const maxDocumentSizeBytes = 50 * 1024 * 1024;

export async function prepareDocumentTemplateUploadAction({
  fileName,
  sizeBytes,
}: {
  fileName: string;
  sizeBytes: number;
}) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);

  if (sizeBytes <= 0 || sizeBytes > maxDocumentSizeBytes) {
    throw new Error("O documento deve ter ate 50 MB.");
  }
  await assertOrganizationStorageQuota(supabase, organization.id, sizeBytes);

  return {
    bucket: "attachments",
    filePath: buildOrganizationStoragePath({
      organizationId: organization.id,
      folder: "documents",
      fileName,
    }),
  };
}

export async function createDocumentTemplateAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = documentTemplateSchema.parse(formDataToObject(formData));
  const fileSize = Number(formData.get("size_bytes")?.toString() || 0);
  if (fileSize > 0) await assertOrganizationStorageQuota(supabase, organization.id, fileSize);
  const storagePath = formData.get("storage_path")?.toString() || parsed.file_path;
  const bucket = formData.get("bucket")?.toString() || "attachments";
  const fileName = formData.get("file_name")?.toString() || null;
  const mimeType = formData.get("mime_type")?.toString() || null;

  const { data, error } = await supabase
    .from("document_templates")
    .insert({
      ...parsed,
      organization_id: organization.id,
      is_global: false,
      bucket,
      storage_path: storagePath,
      file_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: fileSize || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (storagePath && fileName) {
    const { error: attachmentError } = await supabase.from("attachments").insert({
      organization_id: organization.id,
      is_global: false,
      entity_type: "document_template",
      entity_id: data.id,
      bucket,
      storage_path: storagePath,
      file_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: fileSize || null,
      file_size: fileSize || null,
      category: parsed.category,
      uploaded_by: user.id,
      created_by: user.id,
    });
    if (attachmentError) throw new Error(attachmentError.message);
  }

  await logAudit(supabase, {
    action: "document_template.created",
    entityType: "document_template",
    entityId: data.id,
  });

  revalidatePath("/documentos");
}

export async function deleteDocumentTemplateAction(id: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { data: document, error: findError } = await supabase
    .from("document_templates")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .eq("is_global", false)
    .single();
  if (findError) throw new Error(findError.message);

  const storagePath = document.storage_path ?? document.file_path;
  if (storagePath) {
    assertSafeOrganizationStoragePath(organization.id, storagePath);
    const { error: storageError } = await supabase.storage
      .from(document.bucket ?? "attachments")
      .remove([storagePath]);
    if (storageError) throw new Error(storageError.message);
  }

  const { error } = await supabase
    .from("document_templates")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization.id)
    .eq("is_global", false);
  if (error) throw new Error(error.message);

  if (storagePath) {
    await supabase
      .from("attachments")
      .delete()
      .eq("organization_id", organization.id)
      .eq("entity_type", "document_template")
      .eq("entity_id", id)
      .eq("storage_path", storagePath);
  }
  await logAudit(supabase, {
    action: "document_template.deleted",
    entityType: "document_template",
    entityId: id,
  });
  revalidatePath("/documentos");
}

export async function getDocumentTemplateSignedUrlAction(id: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { data: document, error } = await supabase
    .from("document_templates")
    .select("*")
    .eq("id", id)
    .or(`organization_id.eq.${organization.id},is_global.eq.true`)
    .single();
  if (error) throw new Error(error.message);

  const storagePath = document.storage_path ?? document.file_path;
  if (!storagePath) throw new Error("Este documento ainda nao possui arquivo anexado.");
  if (!document.is_global) assertSafeOrganizationStoragePath(organization.id, storagePath);

  const { data, error: signedError } = await supabase.storage
    .from(document.bucket ?? "attachments")
    .createSignedUrl(storagePath, 60 * 10);
  if (signedError) throw new Error(signedError.message);
  return data.signedUrl;
}
