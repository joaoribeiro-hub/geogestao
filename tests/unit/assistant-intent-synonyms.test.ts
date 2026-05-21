import { describe, expect, it } from "vitest";
import { detectAssistantIntent } from "@/lib/assistant/intent-detector";

describe("assistant intent synonyms", () => {
  it("reconhece frases naturais para hoje", () => {
    expect(detectAssistantIntent("o que tem pra hoje?").intent).toBe("list_today_services");
    expect(detectAssistantIntent("o que tenho hoje?").intent).toBe("list_today_services");
    expect(detectAssistantIntent("agenda de hoje").intent).toBe("list_today_services");
  });

  it("reconhece servicos atrasados e vencidos", () => {
    expect(detectAssistantIntent("o que esta atrasado?").intent).toBe("list_overdue_services");
    expect(detectAssistantIntent("tem servico atrasado?").intent).toBe("list_overdue_services");
    expect(detectAssistantIntent("servicos vencidos").intent).toBe("list_overdue_services");
  });

  it("reconhece mes e semana", () => {
    expect(detectAssistantIntent("o que tenho esse mes?").intent).toBe("list_month_services");
    expect(detectAssistantIntent("servicos desta semana").intent).toBe("list_month_services");
  });

  it("mantem baixa confianca quando falta cliente claro na tarefa", () => {
    const detection = detectAssistantIntent("cria uma tarefa pra eu lembrar de chamar o Joao Pedro amanha sobre os documentos");
    expect(detection.intent).toBe("create_client_task");
    expect(detection.params.clientName).toBe("Joao Pedro");
    expect(detection.confidence).toBeGreaterThanOrEqual(0.85);
    expect(detection.params.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("extrai cliente e data em frase com daqui dois", () => {
    const detection = detectAssistantIntent("ccria uma tarefa pra eu lembrar de chamar o Joao Pedro daqui dois para conversar sobre os documentos");
    expect(detection.intent).toBe("create_client_task");
    expect(detection.params.clientName).toBe("Joao Pedro");
    expect(detection.params.description).not.toContain("Joao Pedro");
    expect(detection.params.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
