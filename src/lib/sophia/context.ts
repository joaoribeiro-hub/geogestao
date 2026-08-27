import type { SophiaContext, SophiaContextPack, SophiaRequestContext } from "@/lib/sophia/types";
import { retrieveSophiaMemories } from "@/lib/sophia/v3/memory-manager";

type GenericRow = Record<string, unknown>;

export async function resolveSophiaContext({
  context,
  requestContext,
  message,
}: {
  context: SophiaContext;
  requestContext: SophiaRequestContext;
  message: string;
}): Promise<SophiaContextPack> {
  const [currentClient, currentService, recentMessages, memories, documents] = await Promise.all([
    loadCurrentClient(context, requestContext),
    loadCurrentService(context, requestContext),
    loadRecentMessages(context, requestContext.conversationId),
    retrieveSophiaMemories(context, requestContext, message),
    loadRelevantDocuments(context, requestContext, message),
  ]);

  return {
    screen: requestContext,
    currentClient,
    currentService,
    recentMessages,
    memories,
    documents,
  };
}

async function loadCurrentClient(context: SophiaContext, requestContext: SophiaRequestContext) {
  if (requestContext.entityType !== "client" || !requestContext.entityId) return null;
  const { data, error } = await context.supabase
    .from("clients")
    .select("id,name,document,phone,email,created_at")
    .eq("organization_id", context.organizationId)
    .eq("id", requestContext.entityId)
    .maybeSingle();
  if (error) return null;
  return data as GenericRow | null;
}

async function loadCurrentService(context: SophiaContext, requestContext: SophiaRequestContext) {
  if (requestContext.entityType !== "service" || !requestContext.entityId) return null;
  const { data, error } = await context.supabase
    .from("service_cards")
    .select("id,title,client_id,column_id,due_date,priority,municipality,service_type,updated_at")
    .eq("organization_id", context.organizationId)
    .eq("id", requestContext.entityId)
    .maybeSingle();
  if (error) return null;
  return data as GenericRow | null;
}

async function loadRecentMessages(context: SophiaContext, conversationId?: string | null) {
  if (!conversationId) return [];
  const { data, error } = await context.supabase
    .from("assistant_messages")
    .select("role,content,metadata,created_at")
    .eq("organization_id", context.organizationId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) return [];
  return (data ?? []) as GenericRow[];
}

async function loadRelevantDocuments(context: SophiaContext, requestContext: SophiaRequestContext, message: string) {
  const term = importantTerms(message)[0];
  let query = context.supabase
    .from("documents")
    .select("id,title,original_name,document_type,category,description,processing_status,client_id,service_id,created_at")
    .eq("organization_id", context.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(8);
  if (requestContext.entityType === "client" && requestContext.entityId) query = query.eq("client_id", requestContext.entityId);
  if (requestContext.entityType === "service" && requestContext.entityId) query = query.eq("service_id", requestContext.entityId);
  if (term) {
    const like = `%${term.replace(/[%_]/g, "")}%`;
    query = query.or(`title.ilike.${like},original_name.ilike.${like},document_type.ilike.${like},category.ilike.${like},description.ilike.${like},extracted_text.ilike.${like}`);
  }
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as GenericRow[];
}

function importantTerms(message: string) {
  return message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^\w]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 4)
    .filter((term) => !["qual", "quais", "sobre", "para", "hoje", "servico", "cliente"].includes(term))
    .slice(0, 6);
}
