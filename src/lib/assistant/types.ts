import type { Json } from "@/types/database";

export type AssistantRole = "user" | "assistant";

export type AssistantIntentName =
  | "list_today_services"
  | "list_month_services"
  | "list_overdue_services"
  | "list_pending_tasks"
  | "list_inactive_clients"
  | "find_client_by_name"
  | "summarize_client"
  | "create_client_task"
  | "create_member_task"
  | "create_client_interaction"
  | "create_service"
  | "list_today_checklist"
  | "list_member_checklist"
  | "list_member_current_status"
  | "create_checklist_item"
  | "assign_checklist_item"
  | "complete_service_step"
  | "list_member_activity"
  | "list_member_tasks"
  | "list_client_services"
  | "list_client_commercial_records"
  | "unknown";

export type AssistantConversationContext = {
  lastIntent?: string | null;
  lastMentionedMemberName?: string | null;
  lastMentionedMemberId?: string | null;
  lastChecklistDate?: string | null;
  lastSubjectType?: string | null;
  lastSubjectId?: string | null;
  lastChecklistItems?: Json;
};

export type AssistantIntentDetection = {
  intent: AssistantIntentName;
  confidence: number;
  params: Record<string, Json>;
  needsConfirmation: boolean;
  responseDraft?: string | null;
};

export type AssistantActionStatus = "ok" | "needs_confirmation" | "error";

export type AssistantActionResult = {
  status: AssistantActionStatus;
  message: string;
  actionName: string;
  input: Record<string, Json>;
  output?: Json;
  data?: Json;
  requiresConfirmation?: boolean;
  confirmation?: {
    actionName: string;
    params: Record<string, Json>;
    candidates?: Array<{ id: string; label: string; description?: string | null }>;
  };
};

export type AssistantConfirmationPayload = {
  actionName: string;
  params: Record<string, Json>;
  selectedClientId?: string;
};
