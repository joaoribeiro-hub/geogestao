import { calculateStorageUsage, canUseStorage, formatStorageLimitMessage } from "@/lib/services/storage-quota";
import type { createServerSupabase } from "@/lib/supabase/server";
import type { Organization, OrganizationMember, Plan, Profile } from "@/types/database";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type CurrentOrganization = Organization & { plan?: Plan | null };
export type CurrentOrganizationContext = {
  profile: Profile;
  organization: CurrentOrganization | null;
  membership: OrganizationMember | null;
};

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
  const context = await getCurrentOrganizationContext(supabase, userId);
  if (!context.organization || !context.membership) {
    throw new Error("Usuario sem organizacao vinculada.");
  }

  return context.organization;
}

export async function getCurrentOrganizationContext(
  supabase: ServerSupabase,
  userId: string,
): Promise<CurrentOrganizationContext> {
  const profile = await getCurrentProfile(supabase, userId);
  if (!profile.organization_id) {
    return { profile, organization: null, membership: null };
  }

  const membership = await getOrganizationMembershipForUser(
    supabase,
    profile.organization_id,
    userId,
  );
  if (!membership) {
    return { profile, organization: null, membership: null };
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

  return { profile, organization: { ...organization, plan }, membership };
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

export function canUseOperationalFeatures({
  membership,
}: {
  membership: Pick<OrganizationMember, "role" | "status"> | null;
}) {
  return (
    membership?.status === "active" &&
    (membership.role === "owner" ||
      membership.role === "admin" ||
      membership.role === "gerente" ||
      membership.role === "tecnico" ||
      membership.role === "financeiro")
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

export async function requireOrganization(
  supabase: ServerSupabase,
  userId: string,
) {
  const context = await getCurrentOrganizationContext(supabase, userId);
  if (!context.organization || !context.membership) {
    throw new Error("Conclua o onboarding da empresa para acessar este recurso.");
  }
  return context;
}

export async function requireOrganizationOwner(
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

export async function requireOrganizationAdminOrOwner(
  supabase: ServerSupabase,
  organizationId: string,
  userId: string,
) {
  const membership = await getOrganizationMembershipForUser(supabase, organizationId, userId);
  if (!canViewOrganizationSettings({ membership })) {
    throw new Error("Apenas membros ativos da empresa podem acessar este recurso.");
  }
  return membership;
}

export function canEditCompanySettings({
  membership,
}: {
  membership: Pick<OrganizationMember, "role" | "status"> | null;
}) {
  return membership?.status === "active" && membership.role === "owner";
}

export function getOrganizationPlanLimits(plan?: Pick<Plan, "max_users" | "storage_quota_mb" | "storage_limit_mb" | "ai_enabled"> | null) {
  return {
    maxUsers: plan?.max_users ?? 3,
    storageLimitMb: plan?.storage_limit_mb ?? plan?.storage_quota_mb ?? 3072,
    aiEnabled: plan?.ai_enabled ?? true,
  };
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
