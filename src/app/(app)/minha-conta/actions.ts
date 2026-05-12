"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  assertOrganizationStorageQuota,
  buildOrganizationStoragePath,
  getCurrentOrganizationForUser,
} from "@/lib/organization";
import { profileSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";

const avatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAvatarSizeBytes = 2 * 1024 * 1024;

export async function updateProfileAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);

  const parsed = profileSchema.parse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    birth_date: formData.get("birth_date"),
    document_type: formData.get("document_type"),
    document_number: formData.get("document_number"),
    avatar_path: formData.get("avatar_path"),
    email_preferences: {
      summaries: formData.get("email_summaries") === "on",
      special_dates: formData.get("email_special_dates") === "on",
      projects: formData.get("email_projects") === "on",
      proposals: formData.get("email_proposals") === "on",
      finance: formData.get("email_finance") === "on",
    },
    account_preferences: {
      compact_mode: formData.get("compact_mode") === "on",
    },
  });

  const { error } = await supabase
    .from("profiles")
    .update(parsed)
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    action: "profile.updated",
    entityType: "profile",
    entityId: user.id,
  });

  revalidatePath("/minha-conta");
}

export async function prepareAvatarUploadAction({
  fileName,
  mimeType,
  sizeBytes,
}: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);

  if (!avatarMimeTypes.has(mimeType)) {
    throw new Error("Envie uma imagem JPG, PNG ou WebP.");
  }
  if (sizeBytes <= 0 || sizeBytes > maxAvatarSizeBytes) {
    throw new Error("A foto de perfil deve ter ate 2 MB.");
  }

  await assertOrganizationStorageQuota(supabase, organization.id, sizeBytes);

  return {
    bucket: "attachments",
    filePath: buildOrganizationStoragePath({
      organizationId: organization.id,
      folder: "avatars",
      fileName,
    }),
  };
}

export async function saveAvatarPathAction({
  filePath,
  fileName,
  mimeType,
  sizeBytes,
}: {
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);

  await assertOrganizationStorageQuota(supabase, organization.id, sizeBytes);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_path: filePath })
    .eq("id", user.id);
  if (profileError) throw new Error(profileError.message);

  const { error: attachmentError } = await supabase.from("attachments").insert({
    organization_id: organization.id,
    entity_type: "profile",
    entity_id: user.id,
    bucket: "attachments",
    storage_path: filePath,
    file_path: filePath,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    file_size: sizeBytes,
    category: "avatar",
    uploaded_by: user.id,
    created_by: user.id,
  });
  if (attachmentError) throw new Error(attachmentError.message);

  await logAudit(supabase, {
    action: "profile.avatar_uploaded",
    entityType: "profile",
    entityId: user.id,
  });

  revalidatePath("/minha-conta");
}
