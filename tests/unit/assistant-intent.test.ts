import { describe, expect, it } from "vitest";
import { detectAssistantIntent, extractClientName, normalizeAssistantText } from "@/lib/assistant/intent-detector";

describe("assistant intent detector", () => {
  it("normaliza texto em portugues para regras locais", () => {
    expect(normalizeAssistantText("Quais SERVIÇOS estão ATRASADOS?")).toBe("quais servicos estao atrasados");
  });

  it("detecta servicos de hoje", () => {
    const detection = detectAssistantIntent("Quais os serviços para hoje?");
    expect(detection.intent).toBe("list_today_services");
    expect(detection.confidence).toBeGreaterThan(0.8);
  });

  it("detecta servicos atrasados", () => {
    expect(detectAssistantIntent("Quais serviços estão atrasados?").intent).toBe("list_overdue_services");
  });

  it("extrai cliente para resumo", () => {
    expect(extractClientName("Resumo do cliente Ramon")).toBe("Ramon");
    const detection = detectAssistantIntent("Resumo do cliente Ramon");
    expect(detection.intent).toBe("summarize_client");
    expect(detection.params.clientName).toBe("Ramon");
  });

  it("detecta criacao de tarefa com descricao e cliente", () => {
    const detection = detectAssistantIntent("Criar uma tarefa: convidar o cliente para reunião para o cliente Ramon");
    expect(detection.intent).toBe("create_client_task");
    expect(detection.params.clientName).toBe("Ramon");
    expect(detection.params.description).toBe("convidar o cliente para reunião");
  });

  it("prioriza tarefa para membro sobre servico quando a frase menciona cartorio", () => {
    const detection = detectAssistantIntent(
      'Eu quero que crie uma tarefa para o membro Natalia silva "Ligar para o cartorio de Crixas e peca a matricula 1256"',
    );

    expect(detection.intent).toBe("create_member_task");
    expect(detection.confidence).toBeGreaterThanOrEqual(0.95);
    expect(detection.needsConfirmation).toBe(true);
    expect(detection.params.memberName).toBe("Natalia silva");
    expect(detection.params.description).toBe("Ligar para o cartorio de Crixas e peca a matricula 1256");
  });

  it("nao classifica tarefa com cartorio como create_service", () => {
    const detection = detectAssistantIntent("Crie uma tarefa para o membro Natalia Silva: ligar para o cartorio de Crixas");

    expect(detection.intent).not.toBe("create_service");
    expect(detection.intent).toBe("create_member_task");
  });

  it("detecta atribuicao direta quando usuario diz quero que membro faca algo", () => {
    const detection = detectAssistantIntent("Quero que a Natalia faca o TRI do cliente Almeida");

    expect(detection.intent).toBe("create_member_task");
    expect(detection.needsConfirmation).toBe(true);
    expect(detection.params.memberName).toBe("Natalia");
    expect(detection.params.description).toBe("Fazer o TRI do cliente Almeida");
  });

  it("detecta criacao de interacao", () => {
    const detection = detectAssistantIntent("Criar uma interação no cliente Ramon dizendo que ele pediu retorno amanhã");
    expect(detection.intent).toBe("create_client_interaction");
    expect(detection.params.clientName).toBe("Ramon");
    expect(detection.params.description).toBe("ele pediu retorno amanhã");
  });
  it("prioriza criacao de servico sobre consulta de servicos de hoje", () => {
    const detection = detectAssistantIntent(
      "Salve amigo, eu quero que crie um servico de georeferenciamento para o IMOVEL Jucara, a qual eu tenho um prazo de um mes contando de hoje, sem observacoes, e vou pedir 1.200,50 por esse servico.",
    );

    expect(detection.intent).toBe("create_service");
    expect(detection.needsConfirmation).toBe(true);
    expect(detection.params.serviceType).toBe("georreferenciamento");
    expect(detection.params.propertyName).toBe("Jucara");
    expect(detection.params.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(detection.params.value).toBe(1200.5);
  });

  it("mantem criacao de servico quando a frase pede servico explicitamente", () => {
    const detection = detectAssistantIntent("Crie um servico para o imovel Fazenda Boa Vista");

    expect(detection.intent).toBe("create_service");
    expect(detection.needsConfirmation).toBe(true);
  });

  it("detecta consulta de atividade de membro com nome explicito", () => {
    const detection = detectAssistantIntent(
      "Certo, eu quero saber oque o funcionario (membro) Joao Pedro programou pra fazer hoje, como tambem quero saber oque ele esta fazendo agora.",
    );

    expect(detection.intent).toBe("list_member_current_status");
    expect(detection.params.memberName).toBe("Joao Pedro");
    expect(detection.params.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("usa contexto curto quando a pergunta seguinte fala ele", () => {
    const detection = detectAssistantIntent("Certo, me diga qual que ele ja concluiu, e qual ele esta fazendo agora.", {
      lastMentionedMemberName: "Joao Pedro",
      lastMentionedMemberId: "00000000-0000-4000-8000-000000000001",
      lastChecklistDate: "2026-05-21",
    });

    expect(detection.intent).toBe("list_member_current_status");
    expect(detection.params.memberName).toBe("Joao Pedro");
    expect(detection.params.memberId).toBe("00000000-0000-4000-8000-000000000001");
    expect(detection.params.statusQuestion).toBe("completed_and_current");
  });
});
