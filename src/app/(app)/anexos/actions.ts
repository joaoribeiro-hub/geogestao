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
      folder: `attachments/${entityType}/${entityId}`,
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
}
