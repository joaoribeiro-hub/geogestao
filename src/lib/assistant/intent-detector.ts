import type { AssistantConversationContext, AssistantIntentDetection, AssistantIntentName } from "@/lib/assistant/types";
import { parseBrlCurrencyInput } from "@/lib/services/service-finance";

const synonyms = {
  actionVerbs: ["criar", "crie", "cria", "cadastrar", "cadastre", "adicionar", "registrar", "lancar", "lancar", "gerar", "novo"],
  today: ["hoje", "pra hoje", "para hoje", "no dia de hoje", "agenda de hoje"],
  services: ["servicos", "servico", "agenda", "trabalhos", "demandas"],
  technicalServices: ["servicos", "servico", "georreferenciamento", "georeferenciamento", "car", "itr", "ccir", "trabalhos", "demandas"],
  overdue: ["atrasado", "atrasados", "vencido", "vencidos", "pendentes", "em atraso"],
  createTask: ["criar tarefa", "crie uma tarefa", "criar uma tarefa", "cria uma tarefa", "cria tarefa", "nova tarefa", "tarefa para", "me lembra", "lembrar de", "cadastrar tarefa"],
  interaction: ["interacao", "anotacao", "registrar", "anotar", "historico", "nova interacao", "registrar interacao"],
  checklist: ["checklist", "lista de hoje", "minhas tarefas", "programei", "programou", "programado", "tarefas", "afazeres", "o que eu fiz hoje"],
  month: ["esse mes", "este mes", "mes atual", "do mes", "deste mes", "desse mes"],
  week: ["esta semana", "essa semana", "desta semana", "semana atual"],
};

const clientPatterns = [
  /para\s+(?:o\s+)?cliente\s+(.+)$/i,
  /(?:no|na|do|da)\s+cliente\s+(.+)$/i,
  /(?:chamar|ligar para|falar com|conversar com|contatar)\s+(?:o\s+|a\s+)?(.+?)(?:\s+daqui\b|\s+amanh[ãa]\b|\s+hoje\b|\s+sobre\b|\s+para\b|\s+pra\b|$)/i,
  /(?:resumo|servi[cç]os|propostas|contratos).*cliente\s+(.+)$/i,
  /(?:cria(?:r)?\s+(?:uma\s+)?tarefa\s+(?:para|pra|pro)\s+)(?!eu\b|mim\b|lembrar\b)(.+?)(?:\s+amanh[ãa]|\s+hoje|\s+sobre|$)/i,
  /(?:cliente|do cliente|da cliente|para o cliente|para cliente)\s+(.+?)(?:\s+dizendo|\s+que|\s+com|\s+em|\s*$)/i,
  /(?:resumo do cliente|resumo da cliente|servicos do cliente|serviços do cliente)\s+(.+)$/i,
];

export function detectAssistantIntent(message: string, context?: AssistantConversationContext | null): AssistantIntentDetection {
  const normalized = normalizeAssistantText(message);
  const clientName = extractClientName(message);

  if (hasMemberTaskLanguage(normalized)) {
    return intent(
      "create_member_task",
      0.95,
      {
        memberName: extractTaskMemberName(message),
        description: extractMemberTaskDescription(message),
        title: extractMemberTaskDescription(message),
        date: extractRelativeDate(message) ?? todayDate(),
        dueDate: extractRelativeDate(message) ?? todayDate(),
        isEmergency: hasAny(normalized, ["emergencia", "urgente", "emergencial", "prioridade alta"]),
      },
      true,
    );
  }

  if (hasAny(normalized, synonyms.createTask)) {
    return intent(
      "create_client_task",
      clientName ? 0.92 : 0.72,
      {
        clientName,
        description: extractTaskDescription(message),
        dueDate: extractRelativeDate(message),
      },
      true,
    );
  }

  const isServiceCreation = hasClearServiceCreationLanguage(normalized);

  if (isServiceCreation) {
    return intent(
      "create_service",
      0.94,
      {
        serviceType: extractServiceType(message),
        propertyName: extractPropertyName(message),
        title: extractServiceTitle(message),
        description: extractServiceDescription(message),
        dueDate: extractRelativeDate(message),
        serviceDate: todayDate(),
        value: extractMoneyValue(message),
        priority: extractPriority(message) ?? "medium",
        paymentStatus: "pagamento_nao_efetuado",
        clientName,
      },
      true,
    );
  }

  if (hasAny(normalized, synonyms.interaction) && (clientName || hasAny(normalized, ["cliente", "registrar interacao", "nova interacao", "anotar"]))) {
    return intent(
      "create_client_interaction",
      clientName ? 0.92 : 0.74,
      {
        clientName,
        description: extractInteractionDescription(message),
        date: extractRelativeDate(message),
      },
      true,
    );
  }

  if (hasAny(normalized, synonyms.actionVerbs) && hasAny(normalized, ["checklist", "item", "tarefa de hoje", "afazer"])) {
    return intent(
      "create_checklist_item",
      0.88,
      {
        title: extractChecklistTitle(message),
        date: extractRelativeDate(message) ?? todayDate(),
        isEmergency: hasAny(normalized, ["emergencia", "urgente", "emergencial"]),
      },
      true,
    );
  }

  const explicitMemberName = extractConversationMemberName(message);
  const contextualMemberName = resolveContextualMemberName(normalized, context);
  const memberName = explicitMemberName ?? contextualMemberName;
  const asksMemberChecklist = hasMemberChecklistQuestion(normalized);
  const asksMemberActivity = hasMemberActivityQuestion(normalized);
  if (memberName && (asksMemberChecklist || asksMemberActivity)) {
    return intent(asksMemberActivity ? "list_member_current_status" : "list_member_checklist", explicitMemberName ? 0.94 : 0.9, {
      memberName,
      memberId: explicitMemberName ? null : context?.lastMentionedMemberId ?? null,
      date: extractChecklistDate(normalized),
      statusQuestion: classifyMemberStatusQuestion(normalized),
    });
  }

  if (hasAny(normalized, synonyms.checklist) || hasAny(normalized, ["o que eu programei", "o que eu fiz hoje"])) {
    return intent("list_today_checklist", 0.87, {
      date: normalized.includes("ontem") ? yesterdayDate() : todayDate(),
    });
  }

  if (hasAll(normalized, ["clientes", "sem"]) && hasAny(normalized, ["movimentacao", "retorno", "interacao"])) {
    return intent("list_inactive_clients", 0.82, {
      days: extractDays(message) ?? 30,
    });
  }

  if (hasAny(normalized, ["tarefas pendentes", "tarefas de hoje", "pendencias", "o que tenho para fazer", "para fazer hoje"])) {
    return intent("list_pending_tasks", 0.86, {
      date: normalized.includes("hoje") ? todayDate() : null,
    });
  }

  if (hasAny(normalized, ["propostas", "contratos"]) && clientName) {
    return intent("list_client_commercial_records", 0.84, { clientName });
  }

  if (hasAny(normalized, ["resumo do cliente", "resumo da cliente", "resumir cliente"]) || (normalized.includes("resumo") && clientName)) {
    return intent("summarize_client", 0.88, { clientName });
  }

  if (hasAny(normalized, ["servicos do cliente", "servicos para o cliente"]) || (normalized.includes("servic") && clientName)) {
    return intent("list_client_services", 0.85, { clientName });
  }

  if ((hasAny(normalized, synonyms.services) || hasAny(normalized, ["o que esta", "tem"])) && hasAny(normalized, synonyms.overdue)) {
    return intent("list_overdue_services", 0.9);
  }

  if ((hasAny(normalized, synonyms.services) || hasAny(normalized, ["o que tenho", "o que tem"])) && hasAny(normalized, synonyms.week)) {
    return intent("list_month_services", 0.87, { from: startOfCurrentWeek(), to: endOfCurrentWeek() });
  }

  if ((hasAny(normalized, synonyms.services) || hasAny(normalized, ["o que tenho", "o que tem"])) && hasAny(normalized, synonyms.month)) {
    return intent("list_month_services", 0.88, { from: startOfCurrentMonth(), to: endOfCurrentMonth() });
  }

  if ((hasAny(normalized, synonyms.services) || hasAny(normalized, ["o que tenho", "o que tem"])) && hasAny(normalized, synonyms.today)) {
    return intent("list_today_services", 0.9, { date: todayDate() });
  }

  if (clientName) {
    return intent("find_client_by_name", 0.66, { clientName });
  }

  return intent("unknown", 0.2, {});
}

export function normalizeAssistantText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractClientName(message: string) {
  for (const pattern of clientPatterns) {
    const match = pattern.exec(message);
    const candidate = cleanExtractedName(match?.[1]);
    if (candidate) return candidate;
  }
  return null;
}

function extractTaskDescription(message: string) {
  const afterColon = message.split(":").slice(1).join(":").trim();
  const source = afterColon || message.replace(/cria(?:r)?\s+(uma\s+)?tarefa/i, "").trim();
  return source
    .replace(/\s+para\s+(?:o\s+)?cliente\s+.+$/i, "")
    .replace(/\s+(?:daqui\s+\w+(?:\s+dias?)?|amanh[ãa]|hoje)\b/gi, "")
    .replace(/\b(?:o|a)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}'-]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}'-]+){0,4})\b/gu, "")
    .trim() || "Tarefa criada pelo Assistente IA";
}

function extractInteractionDescription(message: string) {
  const saying = /dizendo que\s+(.+)$/i.exec(message)?.[1];
  if (saying?.trim()) return saying.trim();
  const afterColon = message.split(":").slice(1).join(":").trim();
  return afterColon || message.replace(/(?:cria(?:r)?|registrar|anotar)\s+(uma\s+)?intera[cç][aã]o/i, "").trim();
}

function hasMemberTaskLanguage(normalized: string) {
  const taskTerms = hasAny(normalized, synonyms.createTask) || hasAny(normalized, ["lembrar", "lembra", "responsavel"]);
  const memberTerms = hasAny(normalized, ["para o membro", "para a membro", "para membro", "pro membro", "pra membro", "atribui para", "atribuir para", "responsavel"]);
  const directAssignment =
    /\b(?:quero que|peca para|coloque para|manda|mande)\s+(?:o\s+|a\s+)?[\w\s'-]{2,80}?\s+(?:faca|fazer|realize|revise|ligue|mande|envie|prepare|busque|leve|pegue)\b/.test(
      normalized,
    );
  return (taskTerms && memberTerms) || directAssignment;
}

function hasClearServiceCreationLanguage(normalized: string) {
  if (hasTaskConflictTerms(normalized)) return false;
  if (hasAny(normalized, [
    "criar servico",
    "crie um servico",
    "crie servico",
    "cria um servico",
    "abrir servico",
    "novo servico",
    "cadastrar servico",
    "gerar servico",
    "servico para o imovel",
    "servico de georreferenciamento",
    "servico de georeferenciamento",
  ])) {
    return true;
  }
  const hasCreateVerb = hasAny(normalized, ["criar", "crie", "cria", "cadastrar", "cadastre", "abrir", "gerar", "novo"]);
  const hasTechnicalService = hasAny(normalized, ["georreferenciamento", "georeferenciamento"]) || /\b(?:car|itr|ccir)\b/.test(normalized);
  return hasCreateVerb && hasTechnicalService;
}

export function hasTaskConflictTerms(normalized: string) {
  return hasAny(normalized, [
    "tarefa",
    "tarefas",
    "lembrar",
    "lembra",
    "me lembra",
    "membro",
    "funcionario",
    "colaborador",
    "responsavel",
  ]);
}

function extractTaskMemberName(message: string) {
  const patterns = [
    /(?:quero que|pe[cç]a para|coloque para|manda|mande)\s+(?:o\s+|a\s+)?(.+?)\s+(?:fa[cç]a|fazer|realize|revise|ligue|mande|envie|prepare|busque|leve|pegue)\b/i,
    /(?:para|pra|pro)\s+(?:o\s+|a\s+)?membro\s+(.+?)(?:\s*[:'"]|$)/i,
    /(?:atribui(?:r)?|atribuir|responsavel)\s+(?:para|pra|pro)?\s*(?:o\s+|a\s+)?(.+?)(?:\s*[:'"]|$)/i,
  ];
  for (const pattern of patterns) {
    const candidate = cleanExtractedName(pattern.exec(message)?.[1]);
    if (candidate) return candidate;
  }
  return null;
}

function extractMemberTaskDescription(message: string) {
  const quoted = /["'“”](.+?)["'“”]/.exec(message)?.[1]?.trim();
  if (quoted) return quoted;
  const afterColon = message.split(":").slice(1).join(":").trim();
  if (afterColon) return afterColon;
  const directAssignment =
    /(?:quero que|pe[cç]a para|coloque para|manda|mande)\s+(?:o\s+|a\s+)?(.+?)\s+(fa[cç]a|fazer|realize|revise|ligue|mande|envie|prepare|busque|leve|pegue)\s+(.+)$/i.exec(
      message,
    );
  if (directAssignment?.[3]) {
    const verb = directAssignment[2].toLowerCase();
    const text = directAssignment[3].trim();
    if (/fa[cç]a|fazer/i.test(verb)) return `Fazer ${text}`;
    return `${capitalizeFirst(verb)} ${text}`;
  }
  return message
    .replace(/^.*?(?:crie|criar|cria|nova|cadastrar)\s+(?:uma\s+)?tarefa/i, "")
    .replace(/^.*?me lembra\s+de\s+/i, "")
    .replace(/^.*?lembrar\s+de\s+/i, "")
    .replace(/\s+(?:para|pra|pro)\s+(?:o\s+|a\s+)?membro\s+.+?(?:\s+de\s+|$)/i, " ")
    .replace(/\s+e\s+(?:atribui|atribuir)\s+(?:para|pra|pro)\s+.+$/i, "")
    .replace(/\b(hoje|amanha|amanhÃ£|ontem)\b/gi, "")
    .trim() || "Tarefa criada pelo Assistente IA";
}

function capitalizeFirst(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function extractRelativeDate(message: string) {
  const normalized = normalizeAssistantText(message);
  const today = new Date();
  if (normalized.includes("depois de amanha")) {
    today.setDate(today.getDate() + 2);
    return today.toISOString().slice(0, 10);
  }
  const monthMatch =
    /\b(?:daqui\s+)?(\d+|um|uma|dois|duas|tres)\s+m(?:es|eses)\b/.exec(normalized) ??
    /\bprazo\s+de\s+(\d+|um|uma|dois|duas|tres)\s+m(?:es|eses)\b/.exec(normalized);
  if (monthMatch) {
    today.setMonth(today.getMonth() + wordNumberToNumber(monthMatch[1]));
    return today.toISOString().slice(0, 10);
  }
  const daquiMatch = /\bdaqui\s+(\d+|um|uma|dois|duas|tres)\b/.exec(normalized);
  if (daquiMatch) {
    today.setDate(today.getDate() + wordNumberToNumber(daquiMatch[1]));
    return today.toISOString().slice(0, 10);
  }
  if (normalized.includes("amanha")) {
    today.setDate(today.getDate() + 1);
    return today.toISOString().slice(0, 10);
  }
  if (normalized.includes("hoje")) return todayDate();
  return null;
}

function extractServiceType(message: string) {
  const normalized = normalizeAssistantText(message);
  if (normalized.includes("georreferenciamento") || normalized.includes("georeferenciamento") || normalized.includes(" geo ")) {
    return "georreferenciamento";
  }
  if (/\bcar\b/.test(normalized)) return "car";
  if (normalized.includes("itr") || normalized.includes("ccir")) return "itr_ccir";
  return "outros_servicos";
}

function extractPropertyName(message: string) {
  const patterns = [
    /im[oó]vel\s+(.+?)(?:,|\s+a qual|\s+com|\s+prazo|\s+sem|\s+e vou|\s+por esse|$)/i,
    /imovel\s+(.+?)(?:,|\s+a qual|\s+com|\s+prazo|\s+sem|\s+e vou|\s+por esse|$)/i,
    /propriedade\s+(.+?)(?:,|\s+a qual|\s+com|\s+prazo|\s+sem|\s+e vou|$)/i,
    /fazenda\s+(.+?)(?:,|\s+a qual|\s+com|\s+prazo|\s+sem|\s+e vou|$)/i,
  ];
  for (const pattern of patterns) {
    const candidate = pattern.exec(message)?.[1]?.trim();
    if (candidate) return cleanServicePiece(candidate);
  }
  return null;
}

function extractServiceTitle(message: string) {
  const propertyName = extractPropertyName(message);
  return propertyName ? `Imovel ${propertyName}` : "Servico criado pelo Assistente IA";
}

function extractServiceDescription(message: string) {
  const normalized = normalizeAssistantText(message);
  if (normalized.includes("sem observacoes") || normalized.includes("sem observacao")) return null;
  const match = /observa[cç][oõ]es?\s*[:\-]?\s*(.+?)(?:,|\s+e vou|\s+valor|$)/i.exec(message);
  return match?.[1]?.trim() || null;
}

function extractMoneyValue(message: string) {
  const match =
    /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:,\d{2})?)(?:\s*(?:reais|por esse|pelo servi[cç]o|$))/i.exec(message);
  return match ? parseBrlCurrencyInput(match[1]) : null;
}

function extractPriority(message: string) {
  const normalized = normalizeAssistantText(message);
  if (normalized.includes("urgente")) return "urgent";
  if (normalized.includes("prioridade alta") || normalized.includes("alta prioridade")) return "high";
  if (normalized.includes("prioridade baixa")) return "low";
  return null;
}

function extractChecklistTitle(message: string) {
  const afterColon = message.split(":").slice(1).join(":").trim();
  if (afterColon) return afterColon;
  return message
    .replace(/^(crie|criar|cria|adicionar|adicione|registrar|registre)\s+(um\s+)?(item\s+)?(?:no\s+)?checklist\s*(de hoje)?/i, "")
    .replace(/\b(hoje|amanha|amanhã|ontem)\b/gi, "")
    .trim() || "Item criado pelo Assistente IA";
}

function extractConversationMemberName(message: string) {
  const patterns = [
    /(?:funcion[a-z]*|membro|colaborador[a]?)(?:\s*\([^)]*\))?\s+(.+?)(?:\s+programou|\s+programado|\s+esta|\s+est[aÃ¡]|\s+fazendo|\s+fez|\s+concluiu|\s+tem|\s+para|\s+pra|\s+hoje|\s+agora|,|\.|\?|$)/i,
    /(?:checklist|tarefas|afazeres|atividades)\s+(?:de|da|do)\s+(.+?)(?:\s+hoje|\s+agora|\s+concluiu|\s+abertas|\s+pendentes|,|\.|\?|$)/i,
    /o que\s+(.+?)\s+(?:programou|programado|concluiu)/i,
    /o que\s+(.+?)\s+(?:esta|est[aÃ¡]|fez|fazendo|tem)/i,
    /(?:qual|quais)\s+tarefas?\s+(.+?)\s+(?:concluiu|esta|est[aÃ¡]|fazendo)/i,
  ];
  for (const pattern of patterns) {
    const candidate = cleanExtractedName(pattern.exec(message)?.[1]);
    if (candidate && !/^eu$/i.test(candidate)) return candidate;
  }
  return extractMemberName(message);
}

function resolveContextualMemberName(normalized: string, context?: AssistantConversationContext | null) {
  const hasPronoun =
    /\b(ele|ela)\b/.test(normalized) ||
    hasAny(normalized, ["esse membro", "essa pessoa", "este membro", "esta pessoa"]);
  if (!hasPronoun) return null;
  const memberName = context?.lastMentionedMemberName?.trim();
  return memberName || null;
}

function hasMemberChecklistQuestion(normalized: string) {
  const mentionsMember =
    hasAny(normalized, ["funcionario", "membro", "colaborador", "colaboradora"]) ||
    /\bo que\s+.+?\s+(programou|tem|fez|fazendo|concluiu)/.test(normalized) ||
    /\b(ele|ela)\b/.test(normalized);
  return mentionsMember && hasAny(normalized, [
    "programou",
    "programado",
    "checklist",
    "tarefas",
    "afazeres",
    "fazer hoje",
    "para hoje",
    "pra hoje",
  ]);
}

function hasMemberActivityQuestion(normalized: string) {
  const mentionsMember =
    hasAny(normalized, ["funcionario", "membro", "colaborador", "colaboradora"]) ||
    /\bo que\s+.+?\s+(esta|fez|fazendo|concluiu|programou)/.test(normalized) ||
    /\b(ele|ela)\b/.test(normalized);
  return mentionsMember && hasAny(normalized, [
    "fazendo agora",
    "esta fazendo",
    "atividade",
    "atividades",
    "concluiu",
    "concluido",
    "concluidos",
    "ja concluiu",
    "fazendo",
    "agora",
  ]);
}

function classifyMemberStatusQuestion(normalized: string) {
  const asksCompleted = hasAny(normalized, ["concluiu", "concluido", "concluidos", "ja concluiu"]);
  const asksCurrent = hasAny(normalized, ["fazendo agora", "esta fazendo", "agora", "item atual"]);
  if (asksCompleted && asksCurrent) return "completed_and_current";
  if (asksCompleted) return "completed";
  if (asksCurrent) return "current";
  return "checklist";
}

function extractChecklistDate(normalized: string) {
  if (normalized.includes("ontem")) return yesterdayDate();
  return todayDate();
}

function extractMemberName(message: string) {
  const patterns = [
    /o que\s+(.+?)\s+(?:esta|est[aá]|fez|fazendo|tem)/i,
    /(?:afazeres|atividades)\s+(?:de|da|do)\s+(.+?)(?:\s+hoje|\s+agora|$)/i,
  ];
  for (const pattern of patterns) {
    const candidate = cleanExtractedName(pattern.exec(message)?.[1]);
    if (candidate && !/^eu$/i.test(candidate)) return candidate;
  }
  return null;
}

function extractDays(message: string) {
  const match = /(\d+)\s+dias?/i.exec(message);
  return match ? Number(match[1]) : null;
}

function cleanExtractedName(value: string | undefined) {
  return value
    ?.replace(/\b(dizendo|que|para|pra|com|sobre|daqui|amanha|amanhã|hoje)\b.*$/i, "")
    .replace(/[.?!,;:]+$/g, "")
    .trim() || null;
}

function cleanServicePiece(value: string) {
  return value.replace(/[.?!,;:]+$/g, "").replace(/\s+/g, " ").trim();
}

function wordNumberToNumber(value: string) {
  const normalized = normalizeAssistantText(value);
  if (normalized === "um" || normalized === "uma") return 1;
  if (normalized === "dois" || normalized === "duas") return 2;
  if (normalized === "tres") return 3;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function intent(
  intentName: AssistantIntentName,
  confidence: number,
  params: Record<string, unknown> = {},
  needsConfirmation = false,
): AssistantIntentDetection {
  return {
    intent: intentName,
    confidence,
    params: params as AssistantIntentDetection["params"],
    needsConfirmation,
  };
}

function hasAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(normalizeAssistantText(needle)));
}

function hasAll(value: string, needles: string[]) {
  return needles.every((needle) => value.includes(normalizeAssistantText(needle)));
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

function endOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().slice(0, 10);
}

function startOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday)).toISOString().slice(0, 10);
}

function endOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diffToSunday = day === 0 ? 0 : 7 - day;
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + diffToSunday)).toISOString().slice(0, 10);
}
