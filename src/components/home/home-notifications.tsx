"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDate } from "@/lib/utils";

type Group = "all" | "mentions" | "projects" | "notes";

type HomeNotification = {
  id: string;
  title: string;
  message: string;
  group: Exclude<Group, "all">;
  created_at: string;
  read_at: string | null;
  action_url: string | null;
};

const tabs: Array<{ id: Group; label: string }> = [
  { id: "all", label: "Tudo" },
  { id: "mentions", label: "Mencoes" },
  { id: "projects", label: "Projetos" },
  { id: "notes", label: "Notas" },
];

export function HomeNotifications() {
  const [items, setItems] = useState<HomeNotification[]>([]);
  const [activeTab, setActiveTab] = useState<Group>("all");
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async (includeRead = !unreadOnly) => {
    const response = await fetch(`/api/notifications?includeRead=${includeRead ? "true" : "false"}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { notifications: HomeNotification[] };
    setItems(data.notifications ?? []);
  }, [unreadOnly]);

  useEffect(() => {
    void load(!unreadOnly);
    const onRefresh = () => void load(!unreadOnly);
    window.addEventListener("geogestao:notifications-refresh", onRefresh);
    return () => window.removeEventListener("geogestao:notifications-refresh", onRefresh);
  }, [load, unreadOnly]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (unreadOnly && item.read_at) return false;
        if (activeTab === "all") return true;
        return item.group === activeTab;
      }),
    [activeTab, items, unreadOnly],
  );

  function markAsRead(id: string) {
    startTransition(() => {
      void (async () => {
        await fetch(`/api/notifications/${id}/read`, { method: "POST" });
        setItems((current) =>
          current.map((item) =>
            item.id === id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item,
          ),
        );
        window.dispatchEvent(new Event("geogestao:notifications-refresh"));
      })();
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={activeTab === tab.id ? "default" : "outline"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setUnreadOnly((value) => !value)}
          disabled={pending}
        >
          {unreadOnly ? "Mostrar todas" : "Mostrar apenas nao lidas"}
        </Button>
      </div>

      {filtered.length ? (
        <div className="space-y-2">
          {filtered.slice(0, 10).map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "flex gap-2 rounded-md border bg-background px-3 py-2 text-sm",
                notification.read_at && "opacity-65",
              )}
            >
              <Link
                href={notification.action_url ?? "#"}
                className="min-w-0 flex-1 hover:text-primary"
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{notification.title}</p>
                  <Badge variant="outline">{groupLabel(notification.group)}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(notification.created_at)}</p>
              </Link>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                aria-label="Marcar notificacao como lida"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  markAsRead(notification.id);
                }}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            unreadOnly
              ? activeTab === "all"
                ? "Voce nao tem notificacoes nao lidas."
                : "Voce nao tem notificacoes nao lidas nesta categoria."
              : "Voce nao tem notificacoes nesta categoria."
          }
        />
      )}
    </div>
  );
}

function groupLabel(group: Exclude<Group, "all">) {
  if (group === "mentions") return "Mencao";
  if (group === "projects") return "Projeto";
  return "Nota";
}
