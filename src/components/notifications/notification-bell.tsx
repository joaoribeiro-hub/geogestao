"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  action_url: string | null;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<NotificationItem[]>([]);

  async function load() {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { notifications: NotificationItem[] };
    setItems(data.notifications ?? []);
  }

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener("geogestao:notifications-refresh", onRefresh);
    const interval = window.setInterval(() => void load(), 60000);
    return () => {
      window.removeEventListener("geogestao:notifications-refresh", onRefresh);
      window.clearInterval(interval);
    };
  }, []);

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => {
          setOpen((value) => !value);
          void load();
        }}
        aria-label="Notificacoes"
      >
        <Bell aria-hidden="true" />
        {unread ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
            {unread}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-card p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Notificacoes</p>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {items.length ? (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-2 rounded-md border bg-background p-3 text-sm hover:bg-secondary"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      startTransition(() => {
                        void (async () => {
                          await fetch(`/api/notifications/${item.id}/read`, { method: "POST" });
                          setOpen(false);
                          await load();
                          if (item.action_url) router.push(item.action_url);
                        })();
                      })
                    }
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(item.created_at)}</p>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label="Fechar notificacao"
                    onClick={(event) => {
                      event.stopPropagation();
                      startTransition(() => {
                        void (async () => {
                          await fetch(`/api/notifications/${item.id}/read`, { method: "POST" });
                          setItems((current) => current.filter((notification) => notification.id !== item.id));
                          await load();
                        })();
                      });
                    }}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
                Nenhuma notificacao recente.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
