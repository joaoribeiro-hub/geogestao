import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { answerFromEvidence } from "@/lib/sophia/v3/self-rag";
import { createCognitiveState, transitionCognitiveState } from "@/lib/sophia/v3/cognitive-state";
import { getSophiaSkill } from "@/lib/sophia/v3/skill-library";
import { buildAgentOutput } from "@/lib/ai-agents/runner";

describe("SOPHIA-3 cognitive core", () => {
  it("mantem migration incremental sem duplicar chunks documentais", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/058_sophia_3_cognitive_core.sql"), "utf8");
    expect(migration).toContain("sophia_document_ingestion_jobs");
    expect(migration).toContain("sophia_reflections");
    expect(migration).toContain("sophia_skills");
    expect(migration).toContain("content_tsv");
    expect(migration).toContain("capture_sophia_activity_event");
  });

  it("representa o fluxo cognitivo por fases", () => {
    const initial = createCognitiveState({ organizationId: "org", userId: "user", role: "member", query: "buscar documento", screenContext: {} });
    const next = transitionCognitiveState(initial, "retrieve_context", { intent: "document_search" });
    expect(next.organization_id).toBe("org");
    expect(next.phase).toBe("retrieve_context");
    expect(next.intent).toBe("document_search");
  });

  it("recusa resposta documental sem evidencia e cita chunk quando ha suporte", () => {
    expect(answerFromEvidence([]).answer).toContain("evidencia suficiente");
    const result = answerFromEvidence([{ chunkId: "c1", documentId: "d1", document: "Contrato.pdf", page: 2, snippet: "Prazo de pagamento: 10 dias.", source: "worker", relevance: 1 }]);
    expect(result.answer).toContain("Contrato.pdf");
    expect(result.answer).toContain("chunk c1");
  });

  it("possui skills operacionais com risco explicito", () => {
    const skill = getSophiaSkill("concluir_etapa_servico");
    expect(skill?.tools).toContain("service_steps.complete");
    expect(skill?.requiresConfirmation).toBe(true);
  });

  it("mantem a saida dos agentes como objeto valido mesmo com tarefas de rotina", () => {
    const output = buildAgentOutput({
      summary: "Uma tarefa aberta exige atencao.",
      generatedAt: "2026-08-25T10:00:00.000Z",
      context: {
        tasks: [{ id: "task-1", title: "Revisar rotina" }],
        reminders: [],
        services: [],
        documents: [],
        workTime: [],
        finance: [],
      },
    });
    expect(Array.isArray(output.tasks)).toBe(true);
    expect(output.tasks[0]?.title).toBe("Revisar rotina");
    expect(output.summary).toBeTypeOf("string");
    expect(output.nextActions).toEqual(["Executar: Revisar rotina"]);
  });
});
