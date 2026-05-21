import { describe, expect, it } from "vitest";
import {
  defaultUnknownIntent,
  normalizeExampleText,
  parseIntentDataset,
  parseIntentExampleLine,
  sourceHash,
} from "@/lib/assistant/intent-example-parser";

describe("assistant intent example parser", () => {
  it("parseia dataset TSV com cabecalho Frase, Sinonimo e Funcao", () => {
    const dataset = [
      `Frase\tSinonimo\tFun${"\u00e7\u00e3o"}`,
      "Quais servicos tenho hoje?\tservicos de hoje\tservice.list.today",
      "Resumo do cliente Ramon\tresumo cliente\tclient.summary",
    ].join("\n");

    const summary = parseIntentDataset(dataset);

    expect(summary.totalLines).toBe(3);
    expect(summary.importedCount).toBe(2);
    expect(summary.skippedCount).toBe(1);
    expect(summary.intents["service.list.today"]).toBe(1);
    expect(summary.examples[0]).toMatchObject({
      rawText: "Quais servicos tenho hoje?",
      synonym: "servicos de hoje",
      intentName: "service.list.today",
      sourceLine: 2,
    });
  });

  it("parseia linha JSONL com parametros", () => {
    const line = JSON.stringify({
      texto: "criar tarefa para Joao",
      intent: "client.task.create",
      params: { cliente_nome: "Joao" },
      requiresConfirmation: true,
      confidence: 0.9,
    });

    const parsed = parseIntentExampleLine(line);

    expect(parsed).toMatchObject({
      rawText: "criar tarefa para Joao",
      intentName: "client.task.create",
      paramsSample: { cliente_nome: "Joao" },
      requiresConfirmation: true,
      confidence: 0.9,
    });
  });

  it("parseia linha com seta", () => {
    const parsed = parseIntentExampleLine('"servicos atrasados" -> "service.list.overdue"');

    expect(parsed?.rawText).toBe("servicos atrasados");
    expect(parsed?.intentName).toBe("service.list.overdue");
  });

  it("manda frase sem intent para pendente_classificacao", () => {
    const parsed = parseIntentExampleLine("quero uma ajuda com esse texto");

    expect(parsed?.intentName).toBe(defaultUnknownIntent);
    expect(parsed?.normalizedText).toBe("quero uma ajuda com esse texto");
  });

  it("normaliza e deduplica exemplos repetidos por intent", () => {
    const summary = parseIntentDataset(
      [
        `Frase\tSinonimo\tFun${"\u00e7\u00e3o"}`,
        "Servicos de hoje\tagenda hoje\tservice.list.today",
        "servicos   de HOJE\tagenda hoje\tservice.list.today",
        "servicos   de HOJE\tagenda hoje\tservice.list.overdue",
      ].join("\n"),
    );

    expect(summary.importedCount).toBe(2);
    expect(summary.duplicateCount).toBe(1);
    expect(summary.intents["service.list.today"]).toBe(1);
    expect(summary.intents["service.list.overdue"]).toBe(1);
  });

  it("gera hash estavel sem expor conteudo", () => {
    expect(sourceHash("abc")).toBe(sourceHash("abc"));
    expect(sourceHash("abc")).not.toBe(sourceHash("abcd"));
  });

  it("normaliza texto auxiliar para busca", () => {
    expect(normalizeExampleText("Servi\u00e7os   de HOJE")).toBe("servicos de hoje");
  });
});
