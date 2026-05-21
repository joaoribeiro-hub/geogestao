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
import { legislationSchema } from "@/lib/schemas";
import { assertSafeOrganizationStoragePath } from "@/lib/services/organization-files";
import { createServerSupabase } from "@/lib/supabase/server";

const maxLegislationSizeBytes = 50 * 1024 * 1024;

export async function prepareLegislationUploadAction({
  fileName,
  sizeBytes,
}: {
  fileName: string;
  sizeBytes: number;
}) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);

  if (sizeBytes <= 0 || sizeBytes > maxLegislationSizeBytes) {
    throw new Error("O arquivo deve ter ate 50 MB.");
  }
  await assertOrganizationStorageQuota(supabase, organization.id, sizeBytes);

  return {
    bucket: "attachments",
    filePath: buildOrganizationStoragePath({
      organizationId: organization.id,
      folder: "legislation",
      fileName,
    }),
  };
}

export async function createLegislationAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const parsed = legislationSchema.parse(formDataToObject(formData));
  const fileSize = Number(formData.get("size_bytes")?.toString() || 0);
  if (fileSize > 0) await assertOrganizationStorageQuota(supabase, organization.id, fileSize);
  const storagePath = formData.get("storage_path")?.toString() || null;
  const bucket = formData.get("bucket")?.toString() || "attachments";
  const fileName = formData.get("file_name")?.toString() || null;
  const mimeType = formData.get("mime_type")?.toString() || null;

  const { data, error } = await supabase
    .from("legislation_items")
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
      entity_type: "legislation_item",
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
    action: "legislation_item.created",
    entityType: "legislation_item",
    entityId: data.id,
  });

  revalidatePath("/legislacao");
}

export async function deleteLegislationAction(id: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { data: item, error: findError } = await supabase
    .from("legislation_items")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .eq("is_global", false)
    .single();
  if (findError) throw new Error(findError.message);

  const storagePath = item.storage_path ?? item.file_path;
  if (storagePath) {
    assertSafeOrganizationStoragePath(organization.id, storagePath);
    const { error: storageError } = await supabase.storage
      .from(item.bucket ?? "attachments")
      .remove([storagePath]);
    if (storageError) throw new Error(storageError.message);
  }

  const { error } = await supabase
    .from("legislation_items")
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
      .eq("entity_type", "legislation_item")
      .eq("entity_id", id)
      .eq("storage_path", storagePath);
  }
  await logAudit(supabase, {
    action: "legislation_item.deleted",
    entityType: "legislation_item",
    entityId: id,
  });
  revalidatePath("/legislacao");
}

export async function getLegislationSignedUrlAction(id: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { data: item, error } = await supabase
    .from("legislation_items")
    .select("*")
    .eq("id", id)
    .or(`organization_id.eq.${organization.id},is_global.eq.true`)
    .single();
  if (error) throw new Error(error.message);

  const storagePath = item.storage_path ?? item.file_path;
  if (!storagePath) throw new Error("Esta legislacao ainda nao possui arquivo anexado.");
  if (!item.is_global) assertSafeOrganizationStoragePath(organization.id, storagePath);

  const { data, error: signedError } = await supabase.storage
    .from(item.bucket ?? "attachments")
    .createSignedUrl(storagePath, 60 * 10);
  if (signedError) throw new Error(signedError.message);
  return data.signedUrl;
}
