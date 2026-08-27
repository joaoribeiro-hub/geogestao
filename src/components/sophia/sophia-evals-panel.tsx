"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FlaskConical, Loader2, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EvalCase = { id: string; title: string; input_text: string; expected_tool?: string | null; expected_skill?: string | null };
type EvalRun = { id: string; eval_case_id: string; status: string; result?: Record<string, unknown>; score?: number | null; created_at: string };

export function SophiaEvalsPanel() {
  const [cases, setCases] = useState<EvalCase[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latestByCase = useMemo(() => new Map(runs.map((run) => [run.eval_case_id, run])), [runs]);

  async function load() {
    const response = await fetch("/api/sophia/evals", { cache: "no-store" });
    const data = await response.json().catch(() => null) as { cases?: EvalCase[]; runs?: EvalRun[]; error?: string } | null;
    if (!response.ok) { setMessage(data?.error ?? "Nao foi possivel carregar avaliacoes."); return; }
    setCases(data?.cases ?? []);
    setRuns(data?.runs ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function run(caseId: string) {
    setRunningId(caseId);
    setMessage(null);
    const response = await fetch("/api/sophia/evals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }) });
    const data = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) setMessage(data?.error ?? "A avaliacao falhou.");
    await load();
    setRunningId(null);
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="size-5" aria-hidden="true" />Casos de regressao</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {cases.map((item) => {
          const runResult = latestByCase.get(item.id);
          const passed = (runResult?.score ?? 0) >= 0.99;
          return <div key={item.id} className="grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {runResult ? passed ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> : <XCircle className="size-4 text-destructive" aria-hidden="true" /> : null}
                <p className="font-medium">{item.title}</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.input_text}</p>
              <p className="mt-1 text-xs text-muted-foreground">Skill: {item.expected_skill ?? "resposta segura"} · Tool: {item.expected_tool ?? "nenhuma"}</p>
              {runResult ? <p className="mt-1 text-xs">Ultimo score: {Math.round((runResult.score ?? 0) * 100)}%</p> : null}
            </div>
            <Button type="button" size="sm" onClick={() => void run(item.id)} disabled={runningId === item.id}>
              {runningId === item.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
              Executar
            </Button>
          </div>;
        })}
        {!cases.length ? <p className="text-sm text-muted-foreground">Nenhum caso de avaliacao cadastrado.</p> : null}
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
