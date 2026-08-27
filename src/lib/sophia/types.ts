import type { User } from "@supabase/supabase-js";
import type { createServerSupabase } from "@/lib/supabase/server";
import type { OrganizationMember } from "@/types/database";
import type { Json } from "@/types/database";

export type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type SophiaRiskLevel = "read" | "internal_write" | "external_write" | "destructive";
export type SophiaToolStatus = "available" | "blocked" | "unavailable";
export type SophiaAgentKey =
  | "coordinator"
  | "operations"
  | "documents"
  | "geo"
  | "finance"
  | "routine"
  | "verifier";

export type SophiaContext = {
  supabase: ServerSupabase;
  user: User;
  organizationId: string;
  membership: OrganizationMember | null;
  isOwner: boolean;
};

export type SophiaRequestContext = {
  pathname?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  conversationId?: string | null;
  attachments?: SophiaAttachmentReference[];
};

export type SophiaAttachmentReference = {
  inboxItemId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  source: "sophia_chat";
};

export type SophiaContextPack = {
  screen: SophiaRequestContext;
  currentClient: Record<string, unknown> | null;
  currentService: Record<string, unknown> | null;
  recentMessages: Array<Record<string, unknown>>;
  memories: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
};

export type SophiaToolDefinition = {
  id: string;
  name: string;
  description: string;
  version: string;
  moduleKey?: string;
  agent: SophiaAgentKey;
  riskLevel: SophiaRiskLevel;
  allowedRoles?: string[];
  parameters: Record<string, unknown>;
  execute: (context: SophiaContext, input: Record<string, Json>) => Promise<SophiaToolResult>;
};

export type SophiaToolResult = {
  message: string;
  data?: Json;
  output?: Json;
  status?: "ok" | "needs_confirmation" | "error";
  requiresConfirmation?: boolean;
  confirmation?: {
    actionName: string;
    params: Record<string, Json>;
    candidates?: Array<{ id: string; label: string; description?: string | null }>;
  } | null;
};

export type SophiaPlan = {
  agentKey: SophiaAgentKey;
  toolId: string | null;
  input: Record<string, Json>;
  steps?: Array<{ toolId: string; input: Record<string, Json> }>;
  provider: "local" | "gemini";
  confidence: number;
  requiresConfirmation: boolean;
  reason: string;
};

export type SophiaChatResponse = {
  conversationId?: string;
  messageId?: string;
  intent?: string;
  confidence?: number;
  provider: "local" | "gemini";
  message: string;
  data: Json | null;
  requiresConfirmation: boolean;
  confirmation: SophiaToolResult["confirmation"] | null;
  conversationContext?: Json;
  agentKey?: SophiaAgentKey;
  toolCalls?: Array<{
    toolId: string;
    status: string;
    verified: boolean;
  }>;
};
