"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function AiChatWidget() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
    };
    const outgoingMessages = [...messages, userMessage].slice(-12);
    setMessages(outgoingMessages);
    setInput("");

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: outgoingMessages.map(({ role, content }) => ({ role, content })),
            }),
          });
          const data = (await response.json().catch(() => null)) as {
            message?: string;
            error?: string;
          } | null;
          const content =
            data?.message ??
            data?.error ??
            "Nao foi possivel responder agora. Tente novamente em instantes.";
          setMessages((current) => [
            ...current,
            { id: crypto.randomUUID(), role: "assistant", content },
          ]);
        } catch {
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "Nao foi possivel conectar ao Chat IA agora.",
            },
          ]);
        }
      })();
    });
  }

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3 lg:bottom-6 lg:right-6">
      {open ? (
        <section
          className="flex h-[min(560px,calc(100vh-8rem))] w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-lg border bg-card shadow-xl"
          data-testid="ai-chat-panel"
          aria-label="Chat IA"
        >
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold">Chat IA</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fechar Chat IA"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden="true" />
            </Button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length ? (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[92%] rounded-md px-3 py-2 text-sm leading-relaxed",
                    message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                  data-testid="ai-chat-message"
                >
                  {message.content}
                </div>
              ))
            ) : (
              <div className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
                Pergunte sobre propostas, contratos, projetos, financeiro ou peça ajuda
                para melhorar um texto.
              </div>
            )}
            {pending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Respondendo...
              </div>
            ) : null}
          </div>

          <form className="flex gap-2 border-t p-3" onSubmit={submit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Digite sua pergunta"
              maxLength={1200}
              data-testid="ai-chat-input"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Enviar mensagem"
              disabled={pending || !input.trim()}
              data-testid="ai-chat-send"
            >
              <Send aria-hidden="true" />
            </Button>
          </form>
        </section>
      ) : null}

      <Button
        type="button"
        size="icon"
        className="size-12 rounded-full shadow-lg"
        aria-label={open ? "Minimizar Chat IA" : "Abrir Chat IA"}
        onClick={() => {
          setOpen((current) => !current);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        data-testid="ai-chat-button"
      >
        {open ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
      </Button>
    </div>
  );
}
