"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Candidate = { id: string; rule_key: string; evidence_count: number; status: string; created_at: string };
type Reflection = { id: string; failed_intent?: string | null; user_feedback: string; corrected_answer?: string | null; reflection: string; status: string; created_at: string };

export function SophiaLearningPanel() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  async function load() {
    const response = await fetch("/api/sophia/reflections", { cache: "no-store" });
    const data = await response.json().catch(() => null) as { candidates?: Candidate[]; reflections?: Reflection[]; error?: string } | null;
    if (!response.ok) { setMessage(data?.error ?? "Nao foi possivel carregar aprendizados."); return; }
    setCandidates(data?.candidates ?? []); setReflections(data?.reflections ?? []);
  }
  useEffect(() => { void load(); }, []);
  async function review(id: string, status: "approved" | "rejected") {
    const response = await fetch(`/api/sophia/reflections/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) { setMessage("Nao foi possivel atualizar a regra."); return; }
    await load();
  }
  return <div className="grid gap-6 lg:grid-cols-2">
    <Card><CardHeader><CardTitle>Regras candidatas</CardTitle></CardHeader><CardContent className="space-y-3">{candidates.length ? candidates.map((candidate) => <div key={candidate.id} className="rounded-md border p-3"><p className="font-medium">{candidate.rule_key}</p><p className="text-sm text-muted-foreground">{candidate.evidence_count} evidencia(s) · {candidate.status}</p>{candidate.status === "pending" ? <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => void review(candidate.id, "approved")}>Aprovar</Button><Button size="sm" variant="outline" onClick={() => void review(candidate.id, "rejected")}>Rejeitar</Button></div> : null}</div>) : <p className="text-sm text-muted-foreground">Nenhuma regra candidata aguardando revisao.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Reflexoes recentes</CardTitle></CardHeader><CardContent className="space-y-3">{reflections.length ? reflections.slice(0, 12).map((reflection) => <div key={reflection.id} className="rounded-md border p-3 text-sm"><p className="font-medium">{reflection.failed_intent ?? "Intencao nao identificada"}</p><p className="mt-1 text-muted-foreground">{reflection.user_feedback}</p>{reflection.corrected_answer ? <p className="mt-1">Correcao: {reflection.corrected_answer}</p> : null}</div>) : <p className="text-sm text-muted-foreground">Nenhuma reflexao registrada.</p>}{message ? <p className="text-sm text-destructive">{message}</p> : null}</CardContent></Card>
  </div>;
}

