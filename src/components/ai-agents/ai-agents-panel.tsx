"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type Agent = {
  slug: string;
  name: string;
  description: string | null;
  schedule_type: string | null;
};

export function AiAgentsPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/ai-agents", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as { agents?: Agent[] } | null;
    setAgents(data?.agents ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(slug: string) {
    setRunning(slug);
    setSummary(null);
    const response = await fetch(`/api/ai-agents/${slug}/run`, { method: "POST" });
    const data = (await response.json().catch(() => null)) as { run?: { summary?: string | null }; error?: string } | null;
    setRunning(null);
    setSummary(data?.run?.summary ?? data?.error ?? "Execucao concluida.");
    window.dispatchEvent(new Event("geogestao:notifications-refresh"));
  }

  return (
    <div className="grid gap-3 text-sm">
      {agents.map((agent) => (
        <div key={agent.slug} className="rounded-md border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Bot className="size-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.description}</p>
              </div>
            </div>
            <Button type="button" size="sm" onClick={() => run(agent.slug)} disabled={running === agent.slug}>
              {running === agent.slug ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
              Executar
            </Button>
          </div>
        </div>
      ))}
      {summary ? (
        <div className="max-h-56 overflow-auto rounded-md bg-secondary p-3 text-sm whitespace-pre-wrap">
          {summary}
        </div>
      ) : null}
    </div>
  );
}
