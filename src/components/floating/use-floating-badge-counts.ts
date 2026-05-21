"use client";

import { useCallback, useEffect, useState } from "react";

export type FloatingBadgeCounts = {
  organizationId: string | null;
  checklist: {
    openCount: number;
    ownerAssignedOpenCount: number;
    emergencyOpenCount: number;
    date: string;
  };
  chat: {
    unreadCount: number;
    ownerUnreadCount: number;
    memberUnreadCount: number;
  };
};

const emptyCounts: FloatingBadgeCounts = {
  organizationId: null,
  checklist: {
    openCount: 0,
    ownerAssignedOpenCount: 0,
    emergencyOpenCount: 0,
    date: new Date().toISOString().slice(0, 10),
  },
  chat: {
    unreadCount: 0,
    ownerUnreadCount: 0,
    memberUnreadCount: 0,
  },
};

export function useFloatingBadgeCounts() {
  const [counts, setCounts] = useState<FloatingBadgeCounts>(emptyCounts);
  const [error, setError] = useState<string | null>(null);

  const refreshCounts = useCallback(async () => {
    const response = await fetch("/api/floating-badges", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as FloatingBadgeCounts & { error?: string } | null;
    if (!response.ok || data?.error) {
      setError(data?.error ?? "Nao foi possivel atualizar os contadores.");
      return;
    }
    setCounts(data ?? emptyCounts);
    setError(null);
  }, []);

  useEffect(() => {
    void refreshCounts();
    const interval = window.setInterval(() => {
      void refreshCounts();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [refreshCounts]);

  return { counts, error, refreshCounts, setCounts };
}
