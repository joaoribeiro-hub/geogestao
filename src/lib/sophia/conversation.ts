import type { Json } from "@/types/database";
import type { ServerSupabase } from "@/lib/sophia/types";

export async function ensureSophiaConversation({
  supabase,
  conversationId,
  userId,
  organizationId,
  titleSeed,
}: {
  supabase: ServerSupabase;
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

export async function saveSophiaMessage({
  supabase,
  conversationId,
  organizationId,
  userId,
  role,
  content,
  metadata,
}: {
  supabase: ServerSupabase;
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
