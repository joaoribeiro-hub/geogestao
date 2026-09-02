import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SOPHIA_V4_NODE_ORDER } from "@/lib/sophia/v4/edges";
import { createSophiaV4State } from "@/lib/sophia/v4/state";
import { runSophiaV4Graph, runSophiaV4PlanningGraph } from "@/lib/sophia/v4/graph-runtime";
import { SOPHIA_V4_SKILLS, selectSophiaV4Skill } from "@/lib/sophia/v4/skill-library";
import { verifySophiaV4ToolResult } from "@/lib/sophia/v4/tool-verifier";
import { answerWithSophiaV4Citations } from "@/lib/sophia/v4/self-rag";
import { buildSophiaV4Reflection } from "@/lib/sophia/v4/reflexion-loop";
import { sanitizeSophiaPrivateText } from "@/lib/sophia/v4/privacy-sanitizer";
import { assertFinanceAgentAccess } from "@/lib/sophia/v4/agents";
import { createLocalStubProvider } from "@/lib/sophia/v4/model-providers/local-stub";
import { runSophiaEvalSuite, SOPHIA_V4_DEFAULT_EVAL_CASES } from "@/lib/sophia/v4/evals";
import type { SophiaToolDefinition } from "@/lib/sophia/types";

const tools = [
  tool("members.current_activity", "read"),
  tool("service_steps.complete", "internal_write"),
  tool("services.update_due_date", "internal_write"),
  tool("clients.summarize", "read"),
  tool("document_answer", "read"),
  tool("documents.search", "read"),
  tool("tasks.create_checklist_item", "internal_write"),
  tool("geo.buscageo_jobs.list", "read"),
  tool("geo.environmental_jobs.list", "read"),
  tool("agents.briefing.run", "read"),
  tool("agents.weekly_review.run", "read"),
] satisfies SophiaToolDefinition[];

describe("SOPHIA-4 adaptive agent core", () => {
  it("executa o graph runtime na ordem declarada", async () => {
    const initial = createSophiaV4State({ organizationId: "org", userId: "user", userRole: "owner", inputText: "Mostre os jobs do BuscaGEO" });
    const result = await runSophiaV4Graph(initial, { availableTools: tools, isOwner: true });
    expect(result.trace.map((entry) => entry.node)).toEqual(SOPHIA_V4_NODE_ORDER);
    expect(result.selected_tool).toBe("geo.buscageo_jobs.list");
  });

  it("seleciona Natalia por regra local sem depender de Gemini", async () => {
    const selection = selectSophiaV4Skill("O que a Natalia esta fazendo agora?");
    expect(selection.skill?.skill_key).toBe("consultar_trabalho_atual_membro");
    expect(selection.input.memberName).toBe("Natalia");
    const result = await runSophiaV4PlanningGraph(createSophiaV4State({ organizationId: "org", userId: "user", userRole: "member", inputText: "O que a Natalia esta fazendo agora?" }), { availableTools: tools });
    expect(result.selected_tool).toBe("members.current_activity");
  });

  it("mantem 13 skills reais e exige confirmacao para escritas", () => {
    expect(SOPHIA_V4_SKILLS).toHaveLength(13);
    expect(SOPHIA_V4_SKILLS.find((item) => item.skill_key === "concluir_etapa_servico")?.requires_confirmation).toBe(true);
    expect(SOPHIA_V4_SKILLS.every((item) => item.required_tools.length > 0)).toBe(true);
  });

  it("verificador impede falso sucesso e Self-RAG recusa falta de evidencia", async () => {
    expect((await verifySophiaV4ToolResult({ toolId: "service_steps.complete", result: { message: "", status: "ok" } })).verified).toBe(false);
    expect(answerWithSophiaV4Citations([]).answer).toContain("evidencia suficiente");
    const supported = answerWithSophiaV4Citations([{ chunkId: "c1", documentId: "d1", document: "Contrato.pdf", page: 3, snippet: "O prazo contratual informado e de dez dias uteis.", source: "ocr:tesseract", relevance: 1 }]);
    expect(supported.supported).toBe(true);
    expect(supported.citations[0]?.from_ocr).toBe(true);
  });

  it("cria reflexao estruturada e sanitiza dados privados", () => {
    const reflection = buildSophiaV4Reflection({ question: "O que a Natalia esta fazendo agora?", answer: "Nao sei", feedback: "Consulte as tarefas", correction: "Use a atividade do membro" });
    expect(reflection.correct_skill).toBe("consultar_trabalho_atual_membro");
    expect(reflection.future_test).toContain("Esperado");
    expect(sanitizeSophiaPrivateText("Email teste@empresa.com e telefone (62) 99999-0000")).not.toContain("teste@empresa.com");
  });

  it("bloqueia FinanceAgent para nao-owner e mantém provider local sem modelo", async () => {
    expect(() => assertFinanceAgentAccess(false)).toThrow(/owner/);
    expect(assertFinanceAgentAccess(true)).toBeUndefined();
    const provider = createLocalStubProvider();
    expect(provider.available).toBe(true);
    expect(await provider.generateJson("teste")).toBeNull();
  });

  it("cria migration incremental e preserva a rota assistant legada", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/059_sophia_4_adaptive_agent_core.sql"), "utf8");
    expect(migration).toContain("sophia_skill_runs");
    expect(migration).toContain("sophia_graph_traces");
    expect(migration).toContain("sophia_memory_links");
    expect(migration).toContain("sophia_rule_approvals");
    expect(migration).toContain("organization_id");
    expect(migration).toContain("'requested', 'executed', 'verified', 'failed'");
    expect(readFileSync(join(process.cwd(), "src/app/api/assistant/route.ts"), "utf8")).toContain("export async function POST");
  });

  it("roda a suite inicial e registra o fluxo revisavel de aprendizado", async () => {
    const suite = await runSophiaEvalSuite(SOPHIA_V4_DEFAULT_EVAL_CASES.map((item) => ({
      title: item.title,
      input: item.input,
      expectedTool: item.expectedTool,
      expectedSkill: item.expectedSkill,
      role: "role" in item ? item.role : "owner",
    })), tools);
    expect(suite.results).toHaveLength(8);
    expect(suite.results.map((item) => ({ title: item.title, score: item.score, tool: item.state.selected_tool, skill: item.state.selected_skill }))).toEqual(
      suite.results.map((item) => ({ title: item.title, score: 1, tool: item.state.selected_tool, skill: item.state.selected_skill })),
    );
    const feedback = readFileSync(join(process.cwd(), "src/lib/sophia/v4/reflexion-loop.ts"), "utf8");
    const approval = readFileSync(join(process.cwd(), "src/app/api/sophia/reflections/[id]/route.ts"), "utf8");
    expect(feedback).toContain("evidenceCount >= threshold");
    expect(feedback).toContain('from("sophia_eval_cases")');
    expect(approval).toContain('from("platform_sophia_rules")');
    expect(approval).toContain("requirePlatformDeveloper");
  });

  it("implementa painel lateral acessivel e botoes flutuantes compactos", () => {
    const panel = readFileSync(join(process.cwd(), "src/components/sophia/sophia-side-panel.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(panel).toContain('role="dialog"');
    expect(panel).toContain('event.key === "Escape"');
    expect(css).toContain("translateX(100%)");
    expect(css).toContain("width: 56px");
    expect(css).toContain("min-width: 44px");
    expect(css).toContain("prefers-reduced-motion");
  });
});

function tool(id: string, riskLevel: SophiaToolDefinition["riskLevel"]): SophiaToolDefinition {
  return {
    id,
    name: id,
    description: id,
    version: "1",
    agent: id.startsWith("document") ? "documents" : id.startsWith("geo") ? "geo" : "routine",
    riskLevel,
    parameters: {},
    execute: async () => ({ message: "ok", data: { id } }),
  };
}
