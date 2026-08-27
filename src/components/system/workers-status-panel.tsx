"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, RefreshCw, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkerStatus = {
  key: string;
  name: string;
  url: string;
  urlConfigured: boolean;
  secretConfigured: boolean;
  health: { ok: boolean; status: number | null; service: string | null; latencyMs: number; message?: string } | null;
};

export function WorkersStatusPanel() {
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(key?: string) {
    setError(null);
    if (key) setTesting(key);
    const query = key ? `?worker=${encodeURIComponent(key)}` : "";
    try {
      const response = await fetch(`/api/system/workers${query}`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { workers?: WorkerStatus[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível consultar os workers.");
      if (key) {
        const tested = data.workers?.[0];
        if (tested) setWorkers((current) => current.map((item) => tested.key === item.key ? tested : item));
      } else {
        setWorkers(data.workers ?? []);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível consultar os workers.");
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-4" data-testid="workers-status-panel">
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {workers.map((worker) => {
          const ok = worker.health?.ok === true;
          return (
            <Card key={worker.key}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2"><Server className="size-4" aria-hidden="true" />{worker.name}</CardTitle>
                  <Badge variant={ok ? "default" : "secondary"}>{ok ? "Online" : worker.urlConfigured ? "Não testado" : "Não configurado"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="break-all text-muted-foreground">{worker.url || "URL não configurada"}</p>
                <dl className="grid gap-1 text-xs">
                  <div className="flex justify-between gap-3"><dt>URL</dt><dd>{worker.urlConfigured ? "configurada" : "ausente"}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Segredo</dt><dd>{worker.secretConfigured ? "configurado" : "ausente"}</dd></div>
                  {worker.health ? <div className="flex justify-between gap-3"><dt>Resposta</dt><dd>{worker.health.latencyMs} ms</dd></div> : null}
                </dl>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {ok ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> : <CircleAlert className="size-4 text-amber-600" aria-hidden="true" />}
                  <span>{worker.health?.message ?? (ok ? `Health: ${worker.health?.service ?? worker.key}` : "Clique para testar a conexão")}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void load(worker.key)} disabled={testing === worker.key}>
                  {testing === worker.key ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                  Testar conexão
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
