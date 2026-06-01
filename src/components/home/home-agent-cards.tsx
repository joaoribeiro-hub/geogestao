"use client";

import { useState } from "react";
import { Bot, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type HomeAgentCardData = {
  slug: "briefing-matinal" | "revisao-semanal";
  title: string;
  helperText?: string;
  summary: string | null;
  status: string | null;
  createdAt: string | null;
};

export function HomeAgentCards({ cards }: { cards: HomeAgentCardData[] }) {
  const [items, setItems] = useState(cards);
  const [running, setRunning] = useState<string | null>(null);

  async function refresh(slug: HomeAgentCardData["slug"]) {
    setRunning(slug);
    const response = await fetch(`/api/ai-agents/${slug}/run`, { method: "POST" });
    const data = (await response.json().catch(() => null)) as {
      run?: { summary?: string | null; status?: string; created_at?: string };
      error?: string;
    } | null;
    setRunning(null);
    setItems((current) =>
      current.map((item) =>
        item.slug === slug
          ? {
              ...item,
              summary: data?.run?.summary ?? data?.error ?? "Nao foi possivel atualizar agora.",
              status: data?.run?.status ?? (data?.error ? "error" : item.status),
              createdAt: data?.run?.created_at ?? new Date().toISOString(),
            }
          : item,
      ),
    );
    window.dispatchEvent(new Event("geogestao:notifications-refresh"));
  }

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2" data-testid="home-agent-cards">
      {items.map((card) => (
        <Card key={card.slug}>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="size-5 text-primary" aria-hidden="true" />
                {card.title}
              </CardTitle>
              {card.helperText ? (
                <p className="mt-1 max-w-md text-xs font-semibold text-foreground">
                  {card.helperText}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {card.createdAt ? `Ultima execucao: ${new Date(card.createdAt).toLocaleString("pt-BR")}` : "Ainda sem execucao salva."}
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => refresh(card.slug)} disabled={running === card.slug}>
              {running === card.slug ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              Atualizar agora
            </Button>
          </CardHeader>
          <CardContent>
            <div className="min-h-20 whitespace-pre-wrap rounded-md bg-secondary p-3 text-sm text-secondary-foreground">
              {card.summary ?? (card.slug === "briefing-matinal" ? "Ainda nao ha briefing gerado para hoje." : "Ainda nao ha revisao semanal gerada.")}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
