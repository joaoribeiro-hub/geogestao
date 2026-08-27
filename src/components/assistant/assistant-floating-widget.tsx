"use client";

import { FormEvent, useCallback, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Check, CheckCircle2, FileSearch, Loader2, MessageCircle, PencilLine, Send, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";
import { SophiaAttachmentInput, type SophiaChatAttachment } from "@/components/sophia/sophia-attachment-input";
import { SophiaSidePanel } from "@/components/sophia/sophia-side-panel";

type AssistantResponse = {
  conversationId?: string;
  messageId?: string;
  message?: string;
  error?: string;
  intent?: string;
  confidence?: number;
  provider?: "gemini" | "local";
  data?: Json;
  requiresConfirmation?: boolean;
  confirmation?: {
    actionName: string;
    params: Record<string, Json>;
    candidates?: Array<{ id: string; label: string; description?: string | null }>;
  } | null;
  conversationContext?: AssistantConversationContext;
  toolCalls?: Array<{ toolId: string; status: string; verified: boolean }>;
};

type AssistantConversationContext = {
  lastIntent?: string | null;
  lastMentionedMemberName?: string | null;
  lastMentionedMemberId?: string | null;
  lastChecklistDate?: string | null;
  lastSubjectType?: string | null;
  lastSubjectId?: string | null;
  lastChecklistItems?: Json;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: AssistantResponse["provider"];
  messageId?: string;
  intent?: string;
  data?: Json;
  confirmation?: AssistantResponse["confirmation"];
  originalUserText?: string;
  feedbackSent?: boolean;
  resolvesFeedbackId?: string | null;
  toolCalls?: AssistantResponse["toolCalls"];
};

const examples = [
  "Quais sao meus servicos para hoje?",
  "Quais servicos estao atrasados?",
  "Criar servico de georreferenciamento",
  "Criar item no checklist de hoje",
  "O que eu programei para hoje?",
  "O que Joao fez hoje?",
  "Resumo do cliente Ramon",
];

export function AssistantFloatingWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [lastUserText, setLastUserText] = useState("");
  const [conversationContext, setConversationContext] = useState<AssistantConversationContext>({});
  const [correctionFor, setCorrectionFor] = useState<ChatMessage | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [correctionAttempts, setCorrectionAttempts] = useState(0);
  const [pendingResolvedFeedbackId, setPendingResolvedFeedbackId] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<SophiaChatAttachment | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-assistant",
      role: "assistant",
      content:
        "Sou a Sophia, assistente do GeoGestao. Posso ajudar com servicos, clientes, tarefas, financeiro, documentos e checklists da sua empresa.",
    },
  ]);
  const watchedInboxItems = useRef(new Set<string>());
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const closePanel = useCallback(() => setOpen(false), []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  async function sendMessage(
    content: string,
    confirmation?: NonNullable<AssistantResponse["confirmation"]> & { selectedClientId?: string },
    correctionContext?: { originalMessage: string; correctionText: string; attempts: number },
    resolvesFeedbackIdOverride?: string | null,
    attachmentOverride?: SophiaChatAttachment | null,
  ) {
    const message = content.trim();
    const selectedAttachment = attachmentOverride ?? attachment;
    if ((!message && !selectedAttachment) || pending) return;
    if (!correctionContext) setCorrectionAttempts(0);
    setLastUserText(message);
    setInput("");
    setAttachment(null);
    const userMessage = message || `Arquivo anexado: ${selectedAttachment?.fileName}`;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: userMessage }]);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/sophia/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              message: message || "Arquivo anexado para a Sophia.",
              attachments: selectedAttachment ? [selectedAttachment] : [],
              conversationId,
              context: inferSophiaContext(pathname),
              conversationContext,
              correctionContext: correctionContext ?? null,
              confirmation: confirmation
                ? {
                    actionName: confirmation.actionName,
                    params: confirmation.params,
                    selectedClientId: "selectedClientId" in confirmation ? confirmation.selectedClientId : undefined,
                  }
                : null,
            }),
          });
          const data = (await response.json().catch(() => null)) as AssistantResponse | null;
          if (data?.conversationId) setConversationId(data.conversationId);
          if (data?.conversationContext) setConversationContext(data.conversationContext);
          const resolvesFeedbackId = resolvesFeedbackIdOverride ?? pendingResolvedFeedbackId;
          if (resolvesFeedbackId) setPendingResolvedFeedbackId(null);
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: data?.message ?? data?.error ?? "Nao consegui responder agora. Tente novamente em instantes.",
              provider: data?.provider,
              messageId: data?.messageId,
              intent: data?.intent,
              data: data?.data ?? null,
              confirmation: data?.confirmation ?? null,
              originalUserText: userMessage,
              resolvesFeedbackId,
              toolCalls: data?.toolCalls ?? [],
            },
          ]);
          const inboxItemId = getInboxItemId(data?.data);
          if (inboxItemId && !watchedInboxItems.current.has(inboxItemId)) {
            watchedInboxItems.current.add(inboxItemId);
            void waitForDocumentProcessing(inboxItemId, (statusMessage) => {
              setMessages((current) => [...current, {
                id: crypto.randomUUID(),
                role: "assistant",
                content: statusMessage,
                provider: "local",
              }]);
            });
          }
        } catch {
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "Nao foi possivel conectar a Sophia agora.",
              originalUserText: userMessage,
            },
          ]);
        }
      })();
    });
  }

  async function sendFeedback(message: ChatMessage, rating: "positive" | "negative", correction?: string) {
    const response = await fetch("/api/assistant/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        conversationId,
        messageId: message.messageId,
        messageText: message.originalUserText ?? lastUserText,
        assistantResponse: message.content,
        detectedIntent: message.intent,
        detectedParams: {},
        rating,
        correctionText: correction ?? null,
        source: message.provider ?? "local",
        conversationContext,
        resolvedFeedbackId: rating === "positive" ? message.resolvesFeedbackId ?? null : null,
      }),
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { feedbackId?: string } | null;
    setMessages((current) =>
      current.map((item) => (item.id === message.id ? { ...item, feedbackSent: true } : item)),
    );
    return data?.feedbackId ?? null;
  }

  async function submitCorrection() {
    if (!correctionFor || !correctionText.trim()) return;
    if (correctionAttempts >= 3) {
      setCorrectionFor(null);
      setCorrectionText("");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "Obrigado pela correcao. Vou guardar isso para melhorar, mas vou pausar novas tentativas nesta mensagem.", provider: "local" }]);
      return;
    }
    const original = correctionFor.originalUserText ?? lastUserText;
    const correction = correctionText.trim();
    const feedbackId = await sendFeedback(correctionFor, "negative", correction);
    if (feedbackId) setPendingResolvedFeedbackId(feedbackId);
    const attempts = correctionAttempts + 1;
    setCorrectionAttempts(attempts);
    setCorrectionFor(null);
    setCorrectionText("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "Obrigado. Vou tentar corrigir a resposta.", provider: "local" }]);
    await sendMessage(original, undefined, { originalMessage: original, correctionText: correction, attempts }, feedbackId);
  }

  const footer = correctionFor ? (
    <div>
      <p className="mb-2 text-sm font-medium">O que deveria ter acontecido?</p>
      <textarea
        value={correctionText}
        onChange={(event) => setCorrectionText(event.target.value)}
        className="min-h-24 w-full rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        maxLength={2000}
        aria-label="Correcao da resposta"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setCorrectionFor(null)}>Cancelar</Button>
        <Button type="button" size="sm" onClick={submitCorrection}>Enviar correcao</Button>
      </div>
    </div>
  ) : (
    <form className="flex items-center gap-2" onSubmit={submit}>
      <SophiaAttachmentInput attachment={attachment} onUploaded={setAttachment} onClear={() => setAttachment(null)} disabled={pending} />
      <input
        ref={inputRef}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Pergunte ou solicite uma acao"
        maxLength={1200}
        data-testid="assistant-floating-input"
      />
      <Button type="submit" size="icon" className="size-11 shrink-0" aria-label="Enviar mensagem" disabled={pending || (!input.trim() && !attachment)} data-testid="assistant-floating-send">
        <Send aria-hidden="true" />
      </Button>
    </form>
  );

  return (
    <div className="relative flex flex-col items-end gap-3">
      <SophiaSidePanel open={open} onClose={closePanel} footer={footer} initialFocusRef={inputRef}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {examples.slice(0, 5).map((example) => (
                <button
                  key={example}
                  type="button"
                  className="rounded-md border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => sendMessage(example)}
                >
                  {example}
                </button>
              ))}
            </div>

            {messages.map((message) => (
              <div key={message.id} className={cn("max-w-[94%] rounded-md px-3 py-2 text-sm leading-relaxed", message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                <p>{message.content}</p>
                {process.env.NODE_ENV !== "production" && message.role === "assistant" && message.provider ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">Fonte: {message.provider === "gemini" ? "Gemini" : "Local"}</p>
                ) : null}
                <ResultPreview data={message.data} />
                {message.toolCalls?.some((call) => call.verified) ? (
                  <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-3.5" aria-hidden="true" />Acao verificada no GeoGestao</p>
                ) : null}
                {hasDocumentEvidence(message.data) ? (
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><FileSearch className="size-3.5" aria-hidden="true" />Resposta apoiada em documento processado</p>
                ) : null}
                {message.confirmation ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.confirmation.candidates?.length ? (
                      message.confirmation.candidates.map((candidate) => (
                        <Button
                          key={candidate.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="justify-start bg-background"
                          onClick={() => sendMessage(`Usar ${candidate.label}`, { ...message.confirmation!, selectedClientId: candidate.id })}
                        >
                          <Check aria-hidden="true" />
                          <span className="truncate">{candidate.label}</span>
                        </Button>
                      ))
                    ) : (
                      <>
                        <Button type="button" size="sm" variant="outline" className="bg-background" onClick={() => sendMessage("Confirmo", message.confirmation!)}>
                          <Check aria-hidden="true" />
                          Confirmar acao
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "Acao cancelada.", provider: "local" }])}>
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
                {message.role === "assistant" && message.id !== "welcome-assistant" && !message.feedbackSent ? (
                  <div className="mt-3 border-t pt-2 text-xs">
                    <p className="mb-2 text-muted-foreground">Essa resposta esta correta?</p>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => sendFeedback(message, "positive")}>
                        <ThumbsUp aria-hidden="true" />
                        Sim
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setCorrectionFor(message)}>
                        <PencilLine aria-hidden="true" />
                        Corrigir resposta
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {pending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Consultando o GeoGestao...
              </div>
            ) : null}
          </div>
      </SophiaSidePanel>

      {!open ? <Button
        type="button"
        size="icon"
        className="floating-sophia-button rounded-full shadow-lg"
        aria-label="Abrir Sophia, assistente operacional do GeoGestao"
        title="Abrir Sophia"
        onClick={() => setOpen(true)}
        data-testid="assistant-floating-button"
      >
        <MessageCircle aria-hidden="true" />
      </Button> : null}
    </div>
  );
}

function inferSophiaContext(pathname: string | null) {
  const path = pathname ?? "";
  const serviceMatch = path.match(/^\/servicos\/([0-9a-f-]{36})/i);
  if (serviceMatch?.[1]) return { pathname: path, entityType: "service", entityId: serviceMatch[1] };
  const clientMatch = path.match(/^\/clientes\/([0-9a-f-]{36})/i);
  if (clientMatch?.[1]) return { pathname: path, entityType: "client", entityId: clientMatch[1] };
  return { pathname: path };
}

function getInboxItemId(data?: Json) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return typeof data.inbox_item_id === "string" ? data.inbox_item_id : null;
}

function hasDocumentEvidence(data?: Json) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return Array.isArray(data.citations) && data.citations.length > 0;
}

async function waitForDocumentProcessing(inboxItemId: string, onFinished: (message: string) => void) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
    const response = await fetch(`/api/sophia/inbox/${inboxItemId}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) continue;
        const data = await response.json().catch(() => null) as {
          item?: { status?: string; error_message?: string | null };
          document?: { processing_status?: string; processing_error?: string | null; pages?: number | null } | null;
          chunks?: unknown[];
          summary?: { summary?: string | null } | null;
        } | null;
        const status = data?.item?.status ?? data?.document?.processing_status;
        if (status === "processed" || status === "concluido") {
          const summary = data?.summary?.summary?.trim();
          onFinished(`Documento processado. ${data?.chunks?.length ?? 0} trecho(s) foram indexados.${summary ? `\n\n${summary}` : " Agora você pode perguntar à Sophia sobre o conteúdo."}`);
          return;
    }
    if (["failed", "error", "erro"].includes(status ?? "")) {
      onFinished(`A leitura documental falhou: ${data?.item?.error_message ?? data?.document?.processing_error ?? "verifique os detalhes na Caixa de entrada da Sophia."}`);
      return;
    }
  }
  onFinished("O processamento ainda está demorando. Abra a Caixa de entrada da Sophia para acompanhar o resultado.");
}

function ResultPreview({ data }: { data?: Json }) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const type = typeof data.type === "string" ? data.type : null;
  const items = Array.isArray(data.items) ? data.items : null;
  if (type === "service_created" && typeof data.href === "string") {
    return (
      <a className="mt-2 inline-flex text-xs font-medium text-primary underline" href={data.href}>
        Abrir servico
      </a>
    );
  }
  if (!items?.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {items.slice(0, 5).map((item, index) => (
        <div key={index} className="rounded-md border bg-background/80 p-2 text-xs text-foreground">
          <pre className="whitespace-pre-wrap font-sans">{formatResultItem(type, item)}</pre>
        </div>
      ))}
    </div>
  );
}

function formatResultItem(type: string | null, item: unknown) {
  if (!item || typeof item !== "object") return String(item);
  const value = item as Record<string, unknown>;
  if (type === "services") return `${value.title ?? "Servico"}\nCliente: ${value.client ?? "-"}\nEtapa: ${value.stage ?? "-"}\nPrazo: ${value.dueDate ?? "-"}`;
  if (type === "daily_checklist") return `${value.title ?? "Item"}\nStatus: ${value.status ?? "-"}\nEmergencia: ${value.emergency ? "sim" : "nao"}`;
  if (type === "member_activity") return `${value.title ?? "Atividade"}\nStatus: ${value.status ?? "-"}`;
  return Object.entries(value).slice(0, 5).map(([key, entry]) => `${key}: ${String(entry ?? "-")}`).join("\n");
}
