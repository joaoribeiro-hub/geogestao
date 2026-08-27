"use client";

import { ChevronDown, Check } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OPERATIONAL_PROFILES, operationalProfileLabels, type OperationalProfile } from "@/lib/operational-profile";

export function OperationalProfileSwitcher({
  initialProfile,
  canEdit,
}: {
  initialProfile: OperationalProfile;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [pending, setPending] = useState(false);

  async function selectProfile(next: OperationalProfile) {
    if (!canEdit || pending || next === profile) {
      setOpen(false);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/operational-profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: next }),
      });
      if (!response.ok) throw new Error("Não foi possível alterar o tema operacional.");
      setProfile(next);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative" data-testid="operational-profile-switcher">
      <Button type="button" variant="outline" size="sm" className="w-full justify-between" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>Temas: {operationalProfileLabels[profile]}</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </Button>
      {open ? (
        <div className="absolute left-0 top-11 z-50 w-full min-w-48 rounded-md border bg-card p-1 shadow-xl" role="menu">
          {OPERATIONAL_PROFILES.map((item) => (
            <button key={item} type="button" role="menuitem" disabled={!canEdit || pending} className="flex min-h-11 w-full items-center justify-between rounded px-3 text-left text-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void selectProfile(item)}>
              {operationalProfileLabels[item]}
              {item === profile ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
            </button>
          ))}
          {!canEdit ? <p className="px-3 py-2 text-xs text-muted-foreground">Somente o owner pode alterar.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
