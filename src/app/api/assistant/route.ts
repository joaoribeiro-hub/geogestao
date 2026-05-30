import { NextResponse } from "next/server";
import { z } from "zod";
import { detectAssistantIntent, hasTaskConflictTerms, normalizeAssistantText } from "@/lib/assistant/intent-detector";
import { detectIntentWithGemini, type AssistantIntentResult } from "@/lib/assistant/gemini";
import { findSimilarIntentExamples } from "@/lib/assistant/intent-examples";
import { executeAssistantIntent, intentToActionName } from "@/lib/assistant/actions";
import type {
  AssistantConfirmationPayload,
  AssistantConversationContext,
  AssistantIntentDetection,
  AssistantIntentName,
} from "@/lib/assistant/types";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type AssistantProvider = "gemini" | "local";

const assistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  conversationId: z.string().uuid().optional().nullable(),
  conversationContext: z
    .object({
      lastIntent: z.string().optional().nullable(),
      lastMentionedMemberName: z.string().optional().nullable(),
      lastMentionedMemberId: z.string().uuid().optional().nullable(),
      lastChecklistDate: z.string().optional().nullable(),
      lastSubjectType: z.string().optional().nullable(),
      lastSubjectId: z.string().optional().nullable(),
      lastChecklistItems: z.unknown().optional().nullable(),
    })
    .optional()
    .nullable(),
  correctionContext: z
    .object({
      originalMessage: z.string().optional().nullable(),
      correctionText: z.string().optional().nullable(),
      attempts: z.number().int().min(0).max(3).optional().nullable(),
    })
    .optional()
    .nullable(),
  confirmation: z
    .object({
      actionName: z.string().min(1),
      params: z.record(z.unknown()).default({}),
      selectedClientId: z.string().uuid().optional(),
    })
    .optional()
    .nullable(),
});

export async function POST(request: Request) {
  console.log("[ASSISTENTE] POST /api/assistant recebido");
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);

  const body = await request.json().catch(() => null);
  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Mensagem invalida para a Sophia." },
      { status: 400 },
    );
  }

  const conversation = await ensureConversation({
    supabase,
    conversationId: parsed.data.conversationId,
    userId: user.id,
    organizationId: organization.id,
    titleSeed: parsed.data.message,
  });

  const userMessage = await saveAssistantMessage({
    supabase,
    conversationId: conversation.id,
    organizationId: organization.id,
    userId: user.id,
    role: "user",
    content: parsed.data.message,
    metadata: {
      conversationContext: (parsed.data.conversationContext ?? {}) as Json,
      correctionContext: (parsed.data.correctionContext ?? null) as Json,
    },
  });

  const confirmation = parsed.data.confirmation
    ? {
        actionName: parsed.data.confirmation.actionName,
        params: parsed.data.confirmation.params as Record<string, Json>,
        selectedClientId: parsed.data.confirmation.selectedClientId,
      } satisfies AssistantConfirmationPayload
    : undefined;

  const { detection, provider } = confirmation
    ? {
        detection: detectionFromConfirmation(confirmation),
        provider: "local" as AssistantProvider,
      }
    : await detectIntent(
        supabase,
        parsed.data.message,
        parsed.data.conversationContext as AssistantConversationContext | null | undefined,
        parsed.data.correctionContext,
      );

  console.log("[ASSISTENTE] Intent detectada:", detection.intent);
  console.log("[ASSISTENTE] Provider:", provider);
  const nextConversationContext = buildNextConversationContext(
    parsed.data.conversationContext as AssistantConversationContext | null | undefined,
    detection,
  );

  if (!confirmation && shouldAskWriteConfirmation(detection)) {
    const actionName = intentToActionName[detection.intent];
    const message = buildPendingActionMessage(detection);
    const pendingConfirmation = {
      actionName,
      params: {
        ...detection.params,
        actionName,
      },
    };

    const assistantMessage = await saveAssistantMessage({
      supabase,
      conversationId: conversation.id,
      organizationId: organization.id,
      userId: user.id,
      role: "assistant",
      content: message,
      metadata: {
        intent: detection.intent,
        confidence: detection.confidence,
        provider,
        conversationContext: nextConversationContext as Json,
        requiresConfirmation: true,
        confirmation: pendingConfirmation,
      },
    });

    await logAssistantAction({
      supabase,
      organizationId: organization.id,
      userId: user.id,
      conversationId: conversation.id,
      messageId: userMessage.id,
      actionName,
      input: detection.params,
      output: { pending: true },
      status: "needs_confirmation",
    });

    return NextResponse.json({
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      intent: detection.intent,
      confidence: detection.confidence,
      provider,
      message,
      data: null,
      requiresConfirmation: true,
      confirmation: pendingConfirmation,
      conversationContext: nextConversationContext,
    });
  }

  try {
    const result = await executeAssistantIntent(
      { supabase, user, organizationId: organization.id },
      detection,
      confirmation,
    );

    const assistantMessage = await saveAssistantMessage({
      supabase,
      conversationId: conversation.id,
      organizationId: organization.id,
      userId: user.id,
      role: "assistant",
      content: result.message,
      metadata: {
        intent: detection.intent,
        confidence: detection.confidence,
        provider,
        data: result.data ?? null,
        conversationContext: buildNextConversationContext(nextConversationContext, detection, result.data),
        requiresConfirmation: result.requiresConfirmation ?? false,
      },
    });

    await logAssistantAction({
      supabase,
      organizationId: organization.id,
      userId: user.id,
      conversationId: conversation.id,
      messageId: userMessage.id,
      actionName: result.actionName,
      input: result.input,
      output: result.output ?? result.data ?? {},
      status: result.status,
    });

    return NextResponse.json({
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      intent: detection.intent,
      confidence: detection.confidence,
      provider,
      message: result.message,
      data: result.data ?? null,
      requiresConfirmation: result.requiresConfirmation ?? false,
      confirmation: result.confirmation ?? null,
      conversationContext: buildNextConversationContext(nextConversationContext, detection, result.data),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel executar essa solicitacao agora.";
    await logAssistantAction({
      supabase,
      organizationId: organization.id,
      userId: user.id,
      conversationId: conversation.id,
      messageId: userMessage.id,
      actionName: detection.intent,
      input: detection.params,
      output: { error: message },
      status: "error",
    });

    if (process.env.NODE_ENV !== "production") {
      console.error("[assistant:api]", {
        userId: user.id,
        organizationId: organization.id,
        intent: detection.intent,
        message,
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function detectIntent(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  message: string,
  conversationContext?: AssistantConversationContext | null,
  correctionContext?: { originalMessage?: string | null; correctionText?: string | null; attempts?: number | null } | null,
): Promise<{
  detection: AssistantIntentDetection;
  provider: AssistantProvider;
}> {
  const detectionMessage = correctionContext?.correctionText
    ? `${correctionContext.originalMessage ?? message}. ${correctionContext.correctionText}`
    : message;
  const initialLocalDetection = detectAssistantIntent(detectionMessage, conversationContext);
  console.log("[ASSISTENTE] Local intent inicial:", initialLocalDetection.intent);
  console.log("[ASSISTENTE] Local confidence:", initialLocalDetection.confidence);
  const conflict = detectLocalIntentConflict(detectionMessage, initialLocalDetection);
  const localDetection = conflict
    ? {
        ...initialLocalDetection,
        confidence: Math.min(initialLocalDetection.confidence, 0.4),
      }
    : initialLocalDetection;

  if (conflict) {
    console.log("[ASSISTENTE] Conflito detectado: tarefa vs create_service");
  }

  if (localDetection.confidence >= 0.85 && !conflict) {
    console.log("[ASSISTENTE] Usando interpretador local");
    console.log("[ASSISTENTE] Provider final: local");
    console.log("[ASSISTENTE] Intent final:", localDetection.intent);
    return {
      detection: localDetection,
      provider: "local",
    };
  }

  if (process.env.GEMINI_API_KEY) {
    console.log(conflict ? "[ASSISTENTE] Chamando Gemini por conflito" : "[ASSISTENTE] Tentando usar Gemini");
    try {
      const examples = await findSimilarIntentExamples(supabase, detectionMessage, 12);
      if (process.env.NODE_ENV !== "production") {
        console.log("[ASSISTENTE] Exemplos similares encontrados:", examples.length);
      }
      const controller = new AbortController();
      const geminiResult = await withTimeout(
        detectIntentWithGemini(detectionMessage, examples, controller.signal),
        12000,
        controller,
      );
      console.log("[ASSISTENTE] Gemini usado com sucesso");
      const geminiDetection = mapGeminiIntent(geminiResult);
      console.log("[ASSISTENTE] Provider final: gemini");
      console.log("[ASSISTENTE] Intent final:", geminiDetection.intent);
      return {
        detection: geminiDetection,
        provider: "gemini",
      };
    } catch (error) {
      console.warn("[ASSISTENTE] Gemini falhou, usando local", safeAssistantError(error));
    }
  }

  if (conflict) {
    console.log("[ASSISTENTE] Provider final: local");
    console.log("[ASSISTENTE] Intent final: unknown");
    return {
      detection: {
        intent: "unknown",
        confidence: localDetection.confidence,
        params: {},
        needsConfirmation: false,
      },
      provider: "local",
    };
  }

  console.log("[ASSISTENTE] Usando interpretador local");
  console.log("[ASSISTENTE] Provider final: local");
  console.log("[ASSISTENTE] Intent final:", localDetection.intent);
  return {
    detection: localDetection,
    provider: "local",
  };
}

function detectLocalIntentConflict(message: string, detection: AssistantIntentDetection) {
  if (detection.intent !== "create_service") return false;
  const normalized = normalizeAssistantText(message);
  return hasTaskConflictTerms(normalized) || /["'“”].+["'“”]/.test(message);
}

function mapGeminiIntent(result: AssistantIntentResult): AssistantIntentDetection {
  const intentMap: Record<AssistantIntentResult["intent"], AssistantIntentName> = {
    listar_servicos_hoje: "list_today_services",
    listar_servicos_mes: "list_month_services",
    listar_servicos_atrasados: "list_overdue_services",
    listar_tarefas_pendentes: "list_pending_tasks",
    resumir_cliente: "summarize_client",
    criar_tarefa_cliente: "create_client_task",
    criar_tarefa_membro: "create_member_task",
    criar_interacao_cliente: "create_client_interaction",
    criar_servico: "create_service",
    criar_item_checklist: "create_checklist_item",
    atribuir_item_checklist_membro: "assign_checklist_item",
    consultar_checklist_hoje: "list_today_checklist",
    consultar_checklist_membro: "list_member_checklist",
    consultar_atividade_membro: "list_member_activity",
    consultar_status_atual_membro: "list_member_current_status",
    desconhecido: "unknown",
  };

  const params: Record<string, Json> = {};
  if (result.params.cliente_nome) params.clientName = result.params.cliente_nome;
  if (result.params.descricao) params.description = result.params.descricao;
  if (result.params.data) {
    params.date = result.params.data;
    params.dueDate = result.params.data;
  }
  if (result.params.periodo) params.period = result.params.periodo;
  if (result.params.tipo_servico) params.serviceType = result.params.tipo_servico;
  if (result.params.nome_imovel) {
    params.propertyName = result.params.nome_imovel;
    params.title = `Imovel ${result.params.nome_imovel}`;
  }
  if (result.params.valor) params.value = result.params.valor;
  if (result.params.prazo) params.dueDate = result.params.prazo;
  if (result.params.membro_nome) params.memberName = result.params.membro_nome;
  if (typeof result.params.emergencia === "boolean") params.isEmergency = result.params.emergencia;

  return {
    intent: intentMap[result.intent] ?? "unknown",
    confidence: Number.isFinite(result.confidence) ? result.confidence : 0,
    params,
    needsConfirmation: Boolean(result.requiresConfirmation),
    responseDraft: result.responseDraft ?? null,
  };
}

function detectionFromConfirmation(confirmation: AssistantConfirmationPayload): AssistantIntentDetection {
  const intentMap: Record<string, AssistantIntentName> = {
    listTodayServices: "list_today_services",
    listMonthServices: "list_month_services",
    listOverdueServices: "list_overdue_services",
    listPendingTasks: "list_pending_tasks",
    listInactiveClients: "list_inactive_clients",
    findClientByName: "find_client_by_name",
    summarizeClient: "summarize_client",
    createClientTask: "create_client_task",
    createMemberTask: "create_member_task",
    createClientInteraction: "create_client_interaction",
    createService: "create_service",
    listTodayChecklist: "list_today_checklist",
    listMemberChecklist: "list_member_checklist",
    listMemberCurrentStatus: "list_member_current_status",
    createChecklistItem: "create_checklist_item",
    assignChecklistItem: "assign_checklist_item",
    completeServiceStep: "complete_service_step",
    listMemberActivity: "list_member_activity",
    listClientServices: "list_client_services",
    listClientCommercialRecords: "list_client_commercial_records",
  };

  return {
    intent: intentMap[confirmation.actionName] ?? "unknown",
    confidence: 1,
    params: confirmation.params,
    needsConfirmation: false,
  };
}

function shouldAskWriteConfirmation(detection: AssistantIntentDetection) {
  return detection.needsConfirmation && [
    "create_client_task",
    "create_client_interaction",
    "create_service",
    "create_checklist_item",
  ].includes(detection.intent);
}

function buildPendingActionMessage(detection: AssistantIntentDetection) {
  const clientName = stringParam(detection.params.clientName) ?? "o cliente informado";
  const description = stringParam(detection.params.description) ?? "sem descricao";
  const date = stringParam(detection.params.date) ?? stringParam(detection.params.dueDate);
  if (detection.intent === "create_client_task") {
    return `Confirma criar uma tarefa para ${clientName}${date ? ` para ${date}` : ""}: ${description}?`;
  }
  if (detection.intent === "create_client_interaction") {
    return `Confirma registrar uma interacao no cliente ${clientName}${date ? ` em ${date}` : ""}: ${description}?`;
  }
  if (detection.intent === "create_service") {
    const serviceType = stringParam(detection.params.serviceType) ?? "servico";
    const title = stringParam(detection.params.propertyName) ?? stringParam(detection.params.title) ?? "imovel informado";
    const dueDate = stringParam(detection.params.dueDate) ?? "prazo informado";
    const value = typeof detection.params.value === "number"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(detection.params.value)
      : "valor informado";
    return `Entendi. Vou criar um servico de ${serviceType} para o imovel ${title}, com prazo em ${dueDate} e valor de ${value}. Confirma?`;
  }
  if (detection.intent === "create_checklist_item") {
    const title = stringParam(detection.params.title) ?? description;
    const checklistDate = stringParam(detection.params.date) ?? "hoje";
    return `Confirma adicionar ao seu checklist de ${checklistDate}: ${title}?`;
  }
  if (detection.intent === "assign_checklist_item") {
    const title = stringParam(detection.params.title) ?? description;
    const memberName = stringParam(detection.params.memberName) ?? "o membro informado";
    const checklistDate = stringParam(detection.params.date) ?? "hoje";
    return `Vou adicionar este item ao checklist de ${memberName} para ${checklistDate}: ${title}. Confirma?`;
  }
  return "Confirma executar esta acao?";
}

function stringParam(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildNextConversationContext(
  current: AssistantConversationContext | null | undefined,
  detection: AssistantIntentDetection,
  data?: Json,
): AssistantConversationContext {
  const next: AssistantConversationContext = {
    ...(current ?? {}),
    lastIntent: detection.intent,
  };
  const memberFromParams = stringParam(detection.params.memberName) ?? stringParam(detection.params.membro_nome);
  const memberIdFromParams = stringParam(detection.params.memberId);
  if (memberFromParams) {
    next.lastMentionedMemberName = memberFromParams;
    next.lastSubjectType = "member";
  }
  if (memberIdFromParams) {
    next.lastMentionedMemberId = memberIdFromParams;
    next.lastSubjectId = memberIdFromParams;
    next.lastSubjectType = "member";
  }
  const date = stringParam(detection.params.date) ?? stringParam(detection.params.dueDate);
  if (date) next.lastChecklistDate = date;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const value = data as Record<string, Json>;
    if (value.type === "member_activity" && value.member && typeof value.member === "object" && !Array.isArray(value.member)) {
      const member = value.member as Record<string, Json>;
      const memberId = stringParam(member.id);
      const memberName = stringParam(member.name);
      if (memberId) {
        next.lastMentionedMemberId = memberId;
        next.lastSubjectId = memberId;
      }
      if (memberName) next.lastMentionedMemberName = memberName;
      next.lastSubjectType = "member";
      next.lastChecklistItems = {
        openItems: value.openItems ?? [],
        doneItems: value.doneItems ?? [],
        currentItem: value.currentItem ?? null,
      };
    }
    const checklistDate = stringParam(value.checklistDate) ?? stringParam(value.date);
    if (checklistDate) next.lastChecklistDate = checklistDate;
  }

  return next;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, controller?: AbortController): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          controller?.abort();
          reject(new Error(`Gemini timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function safeAssistantError(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: "Erro desconhecido" };
}

async function ensureConversation({
  supabase,
  conversationId,
  userId,
  organizationId,
  titleSeed,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  conversationId?: string | null;
  userId: string;
  organizationId: string;
  titleSeed: string;
}) {
  if (conversationId) {
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      title: titleSeed.slice(0, 80),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function saveAssistantMessage({
  supabase,
  conversationId,
  organizationId,
  userId,
  role,
  content,
  metadata,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  conversationId: string;
  organizationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  metadata: Json;
}) {
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      user_id: userId,
      role,
      content,
      metadata,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function logAssistantAction({
  supabase,
  organizationId,
  userId,
  conversationId,
  messageId,
  actionName,
  input,
  output,
  status,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  userId: string;
  conversationId: string;
  messageId: string;
  actionName: string;
  input: Json;
  output: Json;
  status: "ok" | "needs_confirmation" | "error";
}) {
  const { error } = await supabase.from("assistant_action_logs").insert({
    organization_id: organizationId,
    user_id: userId,
    conversation_id: conversationId,
    message_id: messageId,
    action_name: actionName,
    input,
    output,
    status,
  });
  if (error) throw new Error(error.message);
}
