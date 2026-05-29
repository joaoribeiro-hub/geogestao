"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, MessageCircleMore, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type TeamChatMessage = {
  id: string;
  senderUserId: string;
  senderName: string;
  senderRole: string;
  isOwnerSender: boolean;
  isMine: boolean;
  message: string;
  createdAt: string;
};

type TeamChatMember = {
  id: string;
  name: string;
  role: string;
};

type TeamChatResponse = {
  organizationId?: string;
  members?: TeamChatMember[];
  messages?: TeamChatMessage[];
  message?: TeamChatMessage;
  error?: string;
};

type TeamChatBadgeCounts = {
  memberUnreadCount: number;
  ownerUnreadCount: number;
};

export function TeamChatWidget({
  organizationId,
  counts,
  onCountsChanged,
}: {
  organizationId?: string | null;
  counts?: TeamChatBadgeCounts;
  onCountsChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [members, setMembers] = useState<TeamChatMember[]>([]);
  const [conversationValue, setConversationValue] = useState("general");
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState(getDateKey());
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const scope = conversationValue === "general" ? "general" : "direct";
  const selectedMemberId = scope === "direct" ? conversationValue : null;
  const selectedMember = members.find((member) => member.id === selectedMemberId);
  const selectedDate = useMemo(() => {
    if (dateFilter === "today") return getDateKey();
    if (dateFilter === "yesterday") return getDateKey(-1);
    return customDate || getDateKey();
  }, [customDate, dateFilter]);

  const markRead = useCallback(async () => {
    await fetch("/api/team-chat/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ scope, recipientUserId: selectedMemberId }),
    }).catch(() => null);
    onCountsChanged?.();
  }, [onCountsChanged, scope, selectedMemberId]);

  const loadMessages = useCallback(async (markAsRead: boolean) => {
    if (scope === "direct" && !selectedMemberId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      scope,
      date: selectedDate,
    });
    if (selectedMemberId) params.set("recipientUserId", selectedMemberId);
    const response = await fetch(`/api/team-chat?${params.toString()}`, { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as TeamChatResponse | null;
    setLoading(false);
    if (!response.ok || data?.error) {
      setError(data?.error ?? "Nao foi possivel carregar o chat da equipe.");
      return;
    }
    setMembers(data?.members ?? []);
    setMessages(data?.messages ?? []);
    if (markAsRead) await markRead();
  }, [markRead, scope, selectedDate, selectedMemberId]);

  useEffect(() => {
    if (!open) return;
    void loadMessages(true);
  }, [loadMessages, open]);

  useEffect(() => {
    if (conversationValue !== "general" && members.length && !members.some((member) => member.id === conversationValue)) {
      setConversationValue("general");
    }
  }, [conversationValue, members]);

  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`team-chat-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_chat_messages",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          void loadMessages(open);
          onCountsChanged?.();
        },
      )
      .subscribe();

    const interval = window.setInterval(() => {
      if (open) void loadMessages(true);
      else onCountsChanged?.();
    }, open ? 15000 : 30000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loadMessages, organizationId, open, supabase, onCountsChanged]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, open]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || pending || (scope === "direct" && !selectedMemberId)) return;
    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/team-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ message, scope, recipientUserId: selectedMemberId }),
        });
        const data = (await response.json().catch(() => null)) as TeamChatResponse | null;
        if (!response.ok || data?.error || !data?.message) {
          setError(data?.error ?? "Nao foi possivel enviar a mensagem.");
          return;
        }
        setMessages((current) => [...current, data.message!]);
        setInput("");
        await markRead();
      })();
    });
  }

  return (
    <div className="fixed bottom-56 right-4 z-40 flex flex-col items-end gap-3 lg:bottom-36 lg:right-6">
      {open ? (
        <section
          className="flex h-[min(560px,calc(100vh-9rem))] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-lg border bg-card shadow-xl"
          data-testid="team-chat-panel"
          aria-label="Chat da equipe"
        >
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircleMore className="size-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold">Chat da equipe</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar Chat da equipe" onClick={() => setOpen(false)}>
              <X aria-hidden="true" />
            </Button>
          </header>

          <div className="space-y-2 border-b p-3">
            <select
              value={conversationValue}
              onChange={(event) => setConversationValue(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Selecionar conversa"
              data-testid="team-chat-conversation-select"
            >
              <option value="general">Geral da empresa</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  Direto: {member.name}
                  {member.role === "owner" ? " (owner)" : ""}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-1.5">
              {(["today", "yesterday", "custom"] as const).map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  variant={dateFilter === filter ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setDateFilter(filter)}
                  data-testid={`team-chat-date-${filter}`}
                >
                  {filter === "today" ? "Hoje" : filter === "yesterday" ? "Ontem" : "Data"}
                </Button>
              ))}
              {dateFilter === "custom" ? (
                <input
                  type="date"
                  value={customDate}
                  onChange={(event) => setCustomDate(event.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Data personalizada do chat"
                />
              ) : null}
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Carregando mensagens...
              </div>
            ) : null}
            {error ? <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p> : null}
            {!loading && !messages.length ? (
              <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
                {scope === "direct"
                  ? "Ainda nao ha mensagens diretas nesta data."
                  : "Ainda nao ha mensagens da equipe nesta data."}
              </p>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[90%] rounded-md border p-3 text-sm",
                  message.isMine ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary",
                  message.isOwnerSender && !message.isMine && "border-destructive/50",
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate font-medium">
                    {message.isMine ? "Voce" : message.senderName}
                    {message.isOwnerSender ? (
                      <span className="ml-2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
                        Owner
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 opacity-75">
                    {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words">{message.message}</p>
              </div>
            ))}
          </div>

          <form className="flex gap-2 border-t p-3" onSubmit={sendMessage}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={scope === "direct" && selectedMember ? `Escreva para ${selectedMember.name}...` : "Escreva uma mensagem para a equipe..."}
              maxLength={1000}
              data-testid="team-chat-input"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Enviar mensagem para equipe"
              disabled={pending || !input.trim() || (scope === "direct" && !selectedMemberId)}
              data-testid="team-chat-send"
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            </Button>
          </form>
        </section>
      ) : null}

      <Button
        type="button"
        size="icon"
        className="relative size-12 rounded-full shadow-lg"
        aria-label={open ? "Minimizar Chat da equipe" : "Abrir Chat da equipe"}
        onClick={() => setOpen((current) => !current)}
        data-testid="team-chat-button"
      >
        {counts?.ownerUnreadCount ? (
          <span
            className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground"
            data-testid="team-chat-owner-badge"
          >
            {counts.ownerUnreadCount}
          </span>
        ) : null}
        {counts?.memberUnreadCount ? (
          <span
            className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold text-white"
            data-testid="team-chat-unread-badge"
          >
            {counts.memberUnreadCount}
          </span>
        ) : null}
        {open ? <X aria-hidden="true" /> : <MessageCircleMore aria-hidden="true" />}
      </Button>
    </div>
  );
}

function getDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
