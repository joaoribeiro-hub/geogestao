import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

const createItemSchema = z.object({
  title: z.string().trim().min(2).max(240),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isEmergency: z.boolean().optional().default(false),
});

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const { data: checklist, error: checklistError } = await supabase
    .from("daily_checklists")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("checklist_date", date)
    .maybeSingle();
  if (checklistError) {
    return NextResponse.json({ error: checklistError.message }, { status: 500 });
  }

  const { data: items, error } = checklist
    ? await supabase
        .from("daily_checklist_items")
        .select("*")
        .eq("organization_id", organization.id)
        .eq("checklist_id", checklist.id)
        .order("is_emergency", { ascending: false })
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ checklist, items: items ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const body = await request.json().catch(() => null);
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Item invalido." }, { status: 400 });

  const { data: checklist, error: upsertError } = await supabase
    .from("daily_checklists")
    .upsert(
      {
        organization_id: organization.id,
        user_id: user.id,
        checklist_date: parsed.data.date,
      },
      { onConflict: "organization_id,user_id,checklist_date" },
    )
    .select("*")
    .single();
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { data: item, error } = await supabase
    .from("daily_checklist_items")
    .insert({
      checklist_id: checklist.id,
      organization_id: organization.id,
      assigned_to: user.id,
      created_by: user.id,
      title: parsed.data.title,
      due_date: parsed.data.date,
      is_emergency: parsed.data.isEmergency,
      source: "self",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("organization_activity_log").insert({
    organization_id: organization.id,
    actor_user_id: user.id,
    target_user_id: user.id,
    activity_type: "checklist_item_created",
    entity_type: "daily_checklist_item",
    entity_id: item.id,
    metadata: { title: item.title, date: parsed.data.date, is_emergency: item.is_emergency },
  });

  return NextResponse.json({ item });
}
