import { GoogleGenAI } from "@google/genai";
import type { AssistantIntentExampleMatch } from "@/lib/assistant/intent-examples";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export type AssistantIntentResult = {
  intent:
    | "listar_servicos_hoje"
    | "listar_servicos_mes"
    | "listar_servicos_atrasados"
    | "listar_tarefas_pendentes"
    | "resumir_cliente"
    | "criar_tarefa_cliente"
    | "criar_tarefa_membro"
    | "criar_interacao_cliente"
    | "criar_servico"
    | "criar_item_checklist"
    | "atribuir_item_checklist_membro"
    | "consultar_checklist_hoje"
    | "consultar_checklist_membro"
    | "consultar_atividade_membro"
    | "consultar_status_atual_membro"
    | "desconhecido";
  confidence: number;
  params: {
    cliente_nome?: string;
    membro_nome?: string;
    descricao?: string;
    data?: string;
    prazo?: string;
    tipo_servico?: "georreferenciamento" | "car" | "itr_ccir" | "outros_servicos";
    nome_imovel?: string;
    valor?: number;
    emergencia?: boolean;
    periodo?: "hoje" | "amanha" | "semana" | "mes";
  };
  requiresConfirmation: boolean;
  responseDraft?: string;
};

function cleanGeminiJsonResponse(text: string) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

export async function detectIntentWithGemini(
  userMessage: string,
  examples: AssistantIntentExampleMatch[] = [],
  signal?: AbortSignal,
): Promise<AssistantIntentResult> {
  console.log("[ASSISTENTE][Gemini] Chamou detectIntentWithGemini");
  console.log(
    "[ASSISTENTE][Gemini] GEMINI_API_KEY existe?",
    Boolean(process.env.GEMINI_API_KEY),
  );

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const similarExamplesText = formatSimilarExamples(examples);

  console.log("[ASSISTENTE][Gemini] Modelo:", model);

  if (!process.env.GEMINI_API_KEY) {
    console.error("[ASSISTENTE][Gemini] GEMINI_API_KEY nao configurada.");
    throw new Error("GEMINI_API_KEY nao configurada.");
  }

  const prompt = `
Voce e o classificador de intencoes do sistema GEOGESTAO.

Sua funcao e interpretar a mensagem do usuario e devolver APENAS JSON valido.

Voce NAO executa acoes.
Voce NAO consulta banco de dados.
Voce NAO inventa dados.
Voce NAO cria tarefas.
Voce apenas classifica a intencao e extrai parametros.

Intencoes permitidas:
- listar_servicos_hoje
- listar_servicos_mes
- listar_servicos_atrasados
- listar_tarefas_pendentes
- resumir_cliente
- criar_tarefa_cliente
- criar_tarefa_membro
- criar_interacao_cliente
- criar_servico
- criar_item_checklist
- atribuir_item_checklist_membro
- consultar_checklist_hoje
- consultar_checklist_membro
- consultar_atividade_membro
- consultar_status_atual_membro
- desconhecido

Formato obrigatorio:
{
  "intent": "uma_das_intencoes_permitidas",
  "confidence": 0.0,
  "params": {
    "cliente_nome": "",
    "membro_nome": "",
    "descricao": "",
    "data": "",
    "prazo": "",
    "tipo_servico": "",
    "nome_imovel": "",
    "valor": 0,
    "emergencia": false,
    "periodo": "hoje"
  },
  "requiresConfirmation": false,
  "responseDraft": ""
}

Usuario: "Crie um servico de georreferenciamento para o imovel Jucara com prazo de um mes e valor 1.200,50"
JSON:
{
  "intent": "criar_servico",
  "confidence": 0.96,
  "params": {
    "tipo_servico": "georreferenciamento",
    "nome_imovel": "Jucara",
    "prazo": "um mes",
    "valor": 1200.5
  },
  "requiresConfirmation": true,
  "responseDraft": ""
}

Exemplos fixos:

Usuario: "Quais os servicos para hoje?"
JSON:
{
  "intent": "listar_servicos_hoje",
  "confidence": 0.95,
  "params": {
    "periodo": "hoje"
  },
  "requiresConfirmation": false,
  "responseDraft": ""
}

Usuario: "Criar uma tarefa: convidar o cliente para reuniao para o cliente Ramon"
JSON:
{
  "intent": "criar_tarefa_cliente",
  "confidence": 0.9,
  "params": {
    "cliente_nome": "Ramon",
    "descricao": "convidar o cliente para reuniao"
  },
  "requiresConfirmation": true,
  "responseDraft": ""
}

Usuario: "Crie uma tarefa para o membro Natalia Silva: ligar para o cartorio de Crixas"
JSON:
{
  "intent": "criar_tarefa_membro",
  "confidence": 0.96,
  "params": {
    "membro_nome": "Natalia Silva",
    "descricao": "ligar para o cartorio de Crixas",
    "periodo": "hoje"
  },
  "requiresConfirmation": true,
  "responseDraft": ""
}

Usuario: "O que o funcionario Joao Pedro programou para hoje e o que ele esta fazendo agora?"
JSON:
{
  "intent": "consultar_status_atual_membro",
  "confidence": 0.94,
  "params": {
    "membro_nome": "Joao Pedro",
    "periodo": "hoje"
  },
  "requiresConfirmation": false,
  "responseDraft": ""
}

Exemplos similares privados do GeoGestao, usados apenas para orientar a classificacao.
Converta a ideia desses exemplos para uma das intencoes permitidas acima.
Nao copie dados reais desses exemplos para a resposta final.
${similarExamplesText}

Mensagem do usuario:
"${userMessage}"
`;

  try {
    if (signal?.aborted) throw new Error("Gemini request aborted");
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (signal?.aborted) throw new Error("Gemini request aborted");
    console.log("[ASSISTENTE][Gemini] Gemini respondeu com sucesso.");

    const rawText = response.text || "{}";

    console.log("[ASSISTENTE][Gemini] Resposta bruta do Gemini:", rawText);

    const cleanedText = cleanGeminiJsonResponse(rawText);

    try {
      const parsed = JSON.parse(cleanedText) as AssistantIntentResult;

      console.log("[ASSISTENTE][Gemini] JSON interpretado com sucesso:", parsed);

      return parsed;
    } catch (parseError) {
      console.error(
        "[ASSISTENTE][Gemini] Erro ao transformar resposta em JSON:",
        parseError,
      );

      return {
        intent: "desconhecido",
        confidence: 0,
        params: {},
        requiresConfirmation: false,
        responseDraft:
          "Nao consegui entender essa solicitacao. Tente escrever de outro jeito.",
      };
    }
  } catch (error) {
    console.error("[ASSISTENTE][Gemini] Erro ao chamar a API do Gemini:", error);
    throw error;
  }
}

function formatSimilarExamples(examples: AssistantIntentExampleMatch[]) {
  if (!examples.length) {
    return "- Nenhum exemplo similar encontrado.";
  }

  return examples
    .slice(0, 12)
    .map((example, index) => {
      const safeText = example.rawText.replace(/\s+/g, " ").slice(0, 180);
      return `${index + 1}. Frase: "${safeText}" | Intent base: ${example.intentName} | Action: ${example.actionName}`;
    })
    .join("\n");
}
