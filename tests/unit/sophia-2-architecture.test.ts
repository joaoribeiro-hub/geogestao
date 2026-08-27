import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getSophiaToolRegistry, planSophiaToolCall } from "@/lib/sophia/tool-registry";

describe("SOPHIA 2.0 architecture", () => {
  it("cria migration incremental para memoria, eventos, inbox, auditoria e access gate", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/054_sophia_2_operational_architecture.sql"), "utf8");
    expect(migration).toContain("create table if not exists public.sophia_runs");
    expect(migration).toContain("create table if not exists public.sophia_tool_calls");
    expect(migration).toContain("create table if not exists public.sophia_memories");
    expect(migration).toContain("create table if not exists public.sophia_events");
    expect(migration).toContain("create table if not exists public.sophia_inbox_items");
    expect(migration).toContain("access_state text not null default 'free'");
    expect(migration).toContain("organization_id");
    expect(migration).toContain("auth.uid()");
  });

  it("registra ferramentas reais e nao mocks demonstrativos", () => {
    const tools = getSophiaToolRegistry();
    expect(tools.map((tool) => tool.id)).toEqual(expect.arrayContaining([
      "services.list_today",
      "tasks.list_pending",
      "clients.summarize",
      "documents.search",
      "geo.environmental_jobs.list",
      "geo.buscageo_jobs.list",
      "service_steps.complete",
    ]));
    expect(tools.some((tool) => tool.description.toLowerCase().includes("mock"))).toBe(false);
  });

  it("planeja escrita com confirmacao humana", () => {
    const plan = planSophiaToolCall("criar item no checklist: ligar para o cliente amanha");
    expect(plan.toolId).toBe("tasks.create_checklist_item");
    expect(plan.requiresConfirmation).toBe(true);
  });

  it("roteia termos de documentos e modulos para agentes especialistas", () => {
    expect(planSophiaToolCall("procure a matricula em documentos").agentKey).toBe("documents");
    expect(planSophiaToolCall("ver jobs da analise ambiental").agentKey).toBe("geo");
  });

  it("widgets usam endpoint Sophia 2.0 e rota antiga fica preservada", () => {
    const floating = readFileSync(join(process.cwd(), "src/components/assistant/assistant-floating-widget.tsx"), "utf8");
    const chat = readFileSync(join(process.cwd(), "src/components/assistant/assistant-chat.tsx"), "utf8");
    const legacyRoute = readFileSync(join(process.cwd(), "src/app/api/assistant/route.ts"), "utf8");
    expect(floating).toContain("/api/sophia/chat");
    expect(chat).toContain("/api/sophia/chat");
    expect(legacyRoute).toContain("export async function POST");
  });

  it("caixa de entrada universal usa bucket privado de documentos", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/sophia/inbox/route.ts"), "utf8");
    expect(route).toContain("DOCUMENTS_BUCKET");
    expect(route).toContain("sophia_inbox_items");
    expect(route).toContain("organizations/${organization.id}/sophia-inbox");
    expect(route).not.toContain("service_role");
  });
});
