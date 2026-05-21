"use client";

import { FormEvent, useState, useTransition } from "react";
import { Bot, Check, Loader2, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";

type AssistantResponse = {
  conversationId?: string;
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
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: AssistantResponse["provider"];
  data?: Json;
  confirmation?: AssistantResponse["confirmation"];
};

const examples = [
  "Quais os servicos para hoje?",
  "Quais servicos estao atrasados?",
  "Resumo do cliente Ramon",
  "Criar uma tarefa: convidar o cliente para reuniao para o cliente Ramon",
];

export function AssistantChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState<AssistantResponse["confirmation"]>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Sou o Assistente IA do GeoGestao. Posso consultar servicos, clientes, tarefas, propostas/contratos e registrar tarefas ou interacoes sem usar SQL livre.",
    },
  ]);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  async function sendMessage(
    content: string,
    confirmation?: NonNullable<AssistantResponse["confirmation"]> & {
      selectedClientId?: string;
    },
  ) {
    const message = content.trim();
    if (!message || pending) return;
    const confirmationToSend =
      confirmation ?? (pendingConfirmation && isAffirmative(message) ? pendingConfirmation : undefined);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");

    if (!confirmation && pendingConfirmation && isNegative(message)) {
      setPendingConfirmation(null);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Certo, cancelei essa acao.",
          provider: "local",
        },
      ]);
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              message,
              conversationId,
              confirmation: confirmationToSend
                ? {
                    actionName: confirmationToSend.actionName,
                    params: confirmationToSend.params,
                    selectedClientId:
                      "selectedClientId" in confirmationToSend
                        ? confirmationToSend.selectedClientId
                        : undefined,
                  }
                : null,
            }),
          });
          const data = (await response.json().catch(() => null)) as AssistantResponse | null;
          if (data?.conversationId) setConversationId(data.conversationId);
          if (data?.confirmation) {
            setPendingConfirmation(data.confirmation);
          } else if (confirmationToSend) {
            setPendingConfirmation(null);
          }
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content:
                data?.message ??
                data?.error ??
                "Nao consegui responder agora. Tente novamente em instantes.",
              provider: data?.provider,
              data: data?.data ?? null,
              confirmation: data?.confirmation ?? null,
            },
          ]);
        } catch {
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "Nao foi possivel conectar ao Assistente IA agora.",
            },
          ]);
        }
      })();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="overflow-hidden">
        <CardContent className="flex h-[68vh] min-h-[560px] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {message.role === "assistant" ? (
                  <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Bot className="size-4" aria-hidden="true" />
                  </div>
                ) : null}
                <div
                  className={cn(
                    "max-w-[82%] rounded-md px-3 py-2 text-sm leading-relaxed",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  <p>{message.content}</p>
                  {process.env.NODE_ENV !== "production" && message.role === "assistant" && message.provider ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Fonte: {message.provider === "gemini" ? "Gemini" : "Local"}
                    </p>
                  ) : null}
                  <ResultPreview data={message.data} />
                  {message.confirmation && !message.confirmation.candidates?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="bg-background"
                        onClick={() => sendMessage("Confirmo", message.confirmation!)}
                      >
                        <Check aria-hidden="true" />
                        Confirmar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPendingConfirmation(null);
                          setMessages((current) => [
                            ...current,
                            {
                              id: crypto.randomUUID(),
                              role: "assistant",
                              content: "Acao cancelada.",
                              provider: "local",
                            },
                          ]);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : null}
                  {message.confirmation?.candidates?.length ? (
                    <div className="mt-3 grid gap-2">
                      {message.confirmation.candidates.map((candidate) => (
                        <Button
                          key={candidate.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="justify-start bg-background"
                          onClick={() =>
                            sendMessage(`Usar ${candidate.label}`, {
                              ...message.confirmation!,
                              selectedClientId: candidate.id,
                            })
                          }
                        >
                          <Check aria-hidden="true" />
                          <span className="truncate">
                            {candidate.label}
                            {candidate.description ? ` - ${candidate.description}` : ""}
                          </span>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {message.role === "user" ? (
                  <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <User className="size-4" aria-hidden="true" />
                  </div>
                ) : null}
              </div>
            ))}
            {pending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Consultando dados do GeoGestao...
              </div>
            ) : null}
          </div>

          <form className="flex gap-2 border-t p-3" onSubmit={submit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Pergunte sobre servicos, clientes, tarefas..."
              maxLength={1200}
              data-testid="assistant-input"
            />
            <Button type="submit" disabled={pending || !input.trim()} data-testid="assistant-send">
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              Enviar
            </Button>
          </form>
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Exemplos</h2>
            <div className="grid gap-2">
              {examples.map((example) => (
                <Button
                  key={example}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal text-left"
                  onClick={() => setInput(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Seguranca</p>
            <p>O assistente nao executa SQL livre e nao apaga dados. Escritas passam pela action registry e ficam registradas em log.</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function isAffirmative(value: string) {
  return /^(sim|confirmo|pode criar|pode registrar|confirmar|ok|isso|pode)$/i.test(value.trim());
}

function isNegative(value: string) {
  return /^(nao|não|cancelar|cancela|deixa|melhor nao|melhor não)$/i.test(value.trim());
}

function ResultPreview({ data }: { data?: Json }) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const type = typeof data.type === "string" ? data.type : null;
  const items = Array.isArray(data.items) ? data.items : null;
  if (!items?.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {items.slice(0, 6).map((item, index) => (
        <div key={index} className="rounded-md border bg-background/80 p-2 text-xs text-foreground">
          <pre className="whitespace-pre-wrap font-sans">{formatResultItem(type, item)}</pre>
        </div>
      ))}
      {items.length > 6 ? (
        <p className="text-xs text-muted-foreground">Mostrando 6 de {items.length} registros.</p>
      ) : null}
    </div>
  );
}

function formatResultItem(type: string | null, item: unknown) {
  if (!item || typeof item !== "object") return String(item);
  const value = item as Record<string, unknown>;
  if (type === "services") {
    return `${value.title ?? "Servico"}\nCliente: ${value.client ?? "-"}\nEtapa: ${value.stage ?? "-"}\nPrazo: ${value.dueDate ?? "-"}`;
  }
  if (type === "tasks") {
    return `${value.title ?? "Tarefa"}\nFonte: ${value.source ?? "-"}\nPrazo: ${value.dueDate ?? "-"}`;
  }
  if (type === "clients" || type === "client_candidates") {
    return `${value.name ?? value.label ?? "Cliente"}\n${value.document ?? value.description ?? ""}`;
  }
  return Object.entries(value)
    .slice(0, 5)
    .map(([key, entry]) => `${key}: ${String(entry ?? "-")}`)
    .join("\n");
}
