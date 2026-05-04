"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import { attachmentSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export async function registerAttachmentAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const parsed = attachmentSchema.parse(formDataToObject(formData));

  const { data, error } = await supabase
    .from("attachments")
    .insert({ ...parsed, uploaded_by: user.id })
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
