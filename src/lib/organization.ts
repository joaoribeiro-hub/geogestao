import { calculateStorageUsage, canUseStorage, formatStorageLimitMessage } from "@/lib/services/storage-quota";
import type { createServerSupabase } from "@/lib/supabase/server";
import type { Organization, OrganizationMember, Plan, Profile } from "@/types/database";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type CurrentOrganization = Organization & { plan?: Plan | null };

export async function getCurrentProfile(
  supabase: ServerSupabase,
  userId: string,
): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCurrentOrganizationForUser(
  supabase: ServerSupabase,
  userId: string,
): Promise<CurrentOrganization> {
  const profile = await getCurrentProfile(supabase, userId);
  if (!profile.organization_id) {
    throw new Error("Usuario sem organizacao vinculada. Execute a migration ACCOUNT-1.");
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.organization_id)
    .single();
  if (error) throw new Error(error.message);

  const { data: plan } = organization.plan_id
    ? await supabase.from("plans").select("*").eq("id", organization.plan_id).maybeSingle()
    : { data: null };

  return { ...organization, plan };
}

export async function getOrganizationMembershipForUser(
  supabase: ServerSupabase,
  organizationId: string,
  userId: string,
): Promise<OrganizationMember | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export function canViewOrganizationSettings({
  membership,
}: {
  membership: Pick<OrganizationMember, "role" | "status"> | null;
}) {
  return (
    membership?.status === "active" &&
    (membership.role === "owner" || membership.role === "admin")
  );
}

export function canManageOrganization({
  profile,
  membership,
}: {
  profile: Pick<Profile, "role"> | null;
  membership: Pick<OrganizationMember, "role" | "status"> | null;
}) {
  void profile;
  return membership?.status === "active" && membership.role === "owner";
}

export async function requireOrganizationManager(
  supabase: ServerSupabase,
  organizationId: string,
  userId: string,
) {
  const [profile, membership] = await Promise.all([
    getCurrentProfile(supabase, userId),
    getOrganizationMembershipForUser(supabase, organizationId, userId),
  ]);

  if (!canManageOrganization({ profile, membership })) {
    throw new Error("Apenas o proprietario da empresa pode editar estas informacoes.");
  }

  return { profile, membership };
}

export async function assertOrganizationStorageQuota(
  supabase: ServerSupabase,
  organizationId: string,
  incomingBytes: number,
) {
  const [{ data: organization, error: organizationError }, { data: attachments, error: attachmentsError }] =
    await Promise.all([
      supabase.from("organizations").select("*").eq("id", organizationId).single(),
      supabase
        .from("attachments")
        .select("file_size,size_bytes")
        .eq("organization_id", organizationId),
    ]);

  if (organizationError) throw new Error(organizationError.message);
  if (attachmentsError) throw new Error(attachmentsError.message);

  const usedBytes = calculateStorageUsage(attachments ?? []);
  const quotaMb = organization.storage_quota_mb;
  if (!canUseStorage({ usedBytes, quotaMb, incomingBytes })) {
    throw new Error(formatStorageLimitMessage());
  }

  return { usedBytes, quotaMb };
}

export function buildOrganizationStoragePath({
  organizationId,
  folder,
  fileName,
}: {
  organizationId: string;
  folder: string;
  fileName: string;
}) {
  const safeName = fileName.replace(/[^\w.-]+/g, "-");
  const safeFolder = folder.replace(/^\/+|\/+$/g, "");
  return `organizations/${organizationId}/${safeFolder}/${crypto.randomUUID()}-${safeName}`;
}
