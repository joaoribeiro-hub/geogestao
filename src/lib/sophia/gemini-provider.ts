import { GoogleGenAI, Type } from "@google/genai";
import type { Json } from "@/types/database";
import type { SophiaContextPack, SophiaPlan, SophiaToolDefinition } from "@/lib/sophia/types";
import { skillsForTools } from "@/lib/sophia/v3/skill-library";
import { getSophiaModelProvider } from "@/lib/sophia/v3/model-provider";

export async function planWithGemini({
  message,
  contextPack,
  tools,
  fallback,
}: {
  message: string;
  contextPack: SophiaContextPack;
  tools: SophiaToolDefinition[];
  fallback: SophiaPlan;
}): Promise<SophiaPlan> {
  if (process.env.SOPHIA_MODEL_PROVIDER === "openai_compatible") {
    const compatible = getSophiaModelProvider();
    if (compatible?.name === "openai_compatible") {
      const planned = await compatible.generateJson(buildCompatiblePrompt(message, contextPack, tools));
      return parseModelPlan(planned, tools, fallback, "openai_compatible");
    }
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !tools.length) {
    const compatible = getSophiaModelProvider();
    if (compatible?.name !== "openai_compatible") return fallback;
    const planned = await compatible.generateJson(buildCompatiblePrompt(message, contextPack, tools));
    return parseModelPlan(planned, tools, fallback, "openai_compatible");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_AGENT_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Voce e a Sophia 2.0, orquestradora do GeoGestao.",
                "Escolha uma unica ferramenta real dentre as disponiveis. Nao invente ferramenta.",
                "Se nenhuma ferramenta servir, use toolId null.",
                "Nao execute escrita sem confirmacao humana.",
                `Mensagem: ${message}`,
                `Contexto: ${JSON.stringify(safeContext(contextPack)).slice(0, 5000)}`,
                `Tools: ${JSON.stringify(toToolList(tools)).slice(0, 7000)}`,
                "Quando uma pergunta exigir mais de uma consulta somente leitura, retorne ate 3 steps em ordem. Nunca coloque escrita em steps; escritas devem ser uma unica tool e depender de confirmacao humana.",
              ].join("\n"),
            },
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            toolId: { type: Type.STRING, nullable: true },
            agentKey: { type: Type.STRING },
            input: { type: Type.OBJECT, nullable: true },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  toolId: { type: Type.STRING },
                  input: { type: Type.OBJECT },
                },
                required: ["toolId", "input"],
              },
            },
          },
          required: ["agentKey", "confidence", "reason"],
        },
      },
    });
    const text = response.text?.trim();
    if (!text) return fallback;
    const parsed = JSON.parse(text) as {
      toolId?: string | null;
      agentKey?: SophiaPlan["agentKey"];
      input?: Record<string, Json> | null;
      confidence?: number;
      reason?: string;
    };
    return parseModelPlan(parsed, tools, fallback, "gemini");
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[sophia:gemini] planejamento indisponivel", error instanceof Error ? error.message : "erro");
    }
    return fallback;
  }
}

function toToolList(tools: SophiaToolDefinition[]) {
  const skills = skillsForTools(tools.map((tool) => tool.id));
  return tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    riskLevel: tool.riskLevel,
    agent: tool.agent,
    moduleKey: tool.moduleKey ?? null,
    parameters: tool.parameters,
    skills: skills.filter((skill) => skill.tools.includes(tool.id)).map((skill) => skill.id),
  }));
}

function buildCompatiblePrompt(message: string, contextPack: SophiaContextPack, tools: SophiaToolDefinition[]) {
  return [
    "Voce e a Sophia 3.0. Responda apenas JSON valido.",
    "Escolha uma tool real ou ate 3 steps somente leitura. Nao invente tool e nao execute escrita sem confirmacao.",
    `Mensagem: ${message}`,
    `Contexto: ${JSON.stringify(safeContext(contextPack)).slice(0, 5000)}`,
    `Tools: ${JSON.stringify(toToolList(tools)).slice(0, 7000)}`,
  ].join("\n");
}

function parseModelPlan(
  parsed: Record<string, unknown> | null,
  tools: SophiaToolDefinition[],
  fallback: SophiaPlan,
  provider: "gemini" | "openai_compatible",
): SophiaPlan {
  if (!parsed) return fallback;
  const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
  const steps = rawSteps.map((step) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) return null;
    const value = step as Record<string, unknown>;
    const tool = tools.find((item) => item.id === value.toolId);
    if (!tool || tool.riskLevel !== "read") return null;
    return { toolId: tool.id, input: (value.input && typeof value.input === "object" && !Array.isArray(value.input) ? value.input : {}) as Record<string, Json> };
  }).filter((step): step is { toolId: string; input: Record<string, Json> } => Boolean(step)).slice(0, 3);
  const tool = tools.find((item) => item.id === parsed.toolId);
  if (!tool && parsed.toolId) return fallback;
  const selected = steps[0] ?? (tool ? { toolId: tool.id, input: (parsed.input ?? fallback.input) as Record<string, Json> } : null);
  return {
    agentKey: tools.find((item) => item.id === selected?.toolId)?.agent ?? fallback.agentKey,
    toolId: selected?.toolId ?? null,
    input: selected?.input ?? fallback.input,
    steps: steps.length > 1 ? steps : undefined,
    provider: provider === "openai_compatible" ? "local" : provider,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : fallback.confidence,
    requiresConfirmation: selected ? tools.find((item) => item.id === selected.toolId)?.riskLevel !== "read" : false,
    reason: typeof parsed.reason === "string" ? parsed.reason : "model_tool_selection",
  };
}

function safeContext(contextPack: SophiaContextPack) {
  return {
    screen: contextPack.screen,
    currentClient: contextPack.currentClient,
    currentService: contextPack.currentService,
    memories: contextPack.memories.slice(0, 5),
    documents: contextPack.documents.slice(0, 5),
    recentMessages: contextPack.recentMessages.slice(0, 4),
  };
}
