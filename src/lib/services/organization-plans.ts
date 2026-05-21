export type PlanLimitsInput = {
  maxUsers?: number | null;
  storageLimitMb?: number | null;
  aiEnabled?: boolean | null;
  maxServices?: number | null;
  maxDocuments?: number | null;
};

export type OrganizationUsageInput = {
  usersCount: number;
  storageUsedMb: number;
  servicesCount?: number;
  documentsCount?: number;
};

export function getOrganizationPlanLimits(plan?: PlanLimitsInput | null) {
  return {
    maxUsers: plan?.maxUsers ?? 3,
    storageLimitMb: plan?.storageLimitMb ?? 3072,
    aiEnabled: plan?.aiEnabled ?? true,
    maxServices: plan?.maxServices ?? null,
    maxDocuments: plan?.maxDocuments ?? null,
  };
}

export function canJoinOrganization({
  maxUsers,
  usersCount,
}: {
  maxUsers: number | null;
  usersCount: number;
}) {
  return maxUsers === null || usersCount < maxUsers;
}

export function canUploadFile({
  storageLimitMb,
  storageUsedMb,
  incomingMb = 0,
}: {
  storageLimitMb: number | null;
  storageUsedMb: number;
  incomingMb?: number;
}) {
  return storageLimitMb === null || storageUsedMb + incomingMb <= storageLimitMb;
}

export function canCreateService({
  maxServices,
  servicesCount,
}: {
  maxServices: number | null;
  servicesCount: number;
}) {
  return maxServices === null || servicesCount < maxServices;
}

export function canUseAssistant({
  aiEnabled,
}: {
  aiEnabled: boolean;
}) {
  return aiEnabled;
}

export function summarizePlanUsage({
  limits,
  usage,
}: {
  limits: ReturnType<typeof getOrganizationPlanLimits>;
  usage: OrganizationUsageInput;
}) {
  return {
    users: {
      used: usage.usersCount,
      limit: limits.maxUsers,
      canAdd: canJoinOrganization({
        maxUsers: limits.maxUsers,
        usersCount: usage.usersCount,
      }),
    },
    storage: {
      usedMb: usage.storageUsedMb,
      limitMb: limits.storageLimitMb,
      canUpload: canUploadFile({
        storageLimitMb: limits.storageLimitMb,
        storageUsedMb: usage.storageUsedMb,
      }),
    },
    services: {
      used: usage.servicesCount ?? 0,
      limit: limits.maxServices,
      canCreate: canCreateService({
        maxServices: limits.maxServices,
        servicesCount: usage.servicesCount ?? 0,
      }),
    },
    documents: {
      used: usage.documentsCount ?? 0,
      limit: limits.maxDocuments,
    },
    assistant: {
      enabled: canUseAssistant({ aiEnabled: limits.aiEnabled }),
    },
  };
}
