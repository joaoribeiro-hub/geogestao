import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

const reorderSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ordem invalida." }, { status: 400 });

  const uniqueItemIds = Array.from(new Set(parsed.data.itemIds));
  const { data: items, error } = await supabase
    .from("daily_checklist_items")
    .select("id,assigned_to,created_by")
    .eq("organization_id", organization.id)
    .in("id", uniqueItemIds)
    .is("deleted_at", null)
    .is("archived_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ((items ?? []).length !== uniqueItemIds.length) {
    return NextResponse.json({ error: "Alguns itens nao foram encontrados nesta empresa." }, { status: 404 });
  }
  const canReorder = (items ?? []).every((item) => item.assigned_to === user.id || item.created_by === user.id);
  if (!canReorder) {
    return NextResponse.json({ error: "Sem permissao para reordenar estes itens." }, { status: 403 });
  }

  await Promise.all(uniqueItemIds.map((itemId, index) => {
    const sortOrder = (index + 1) * 1000;
    return supabase
      .from("daily_checklist_items")
      .update({ sort_order: sortOrder })
      .eq("id", itemId)
      .eq("organization_id", organization.id);
  }));

  await Promise.all(uniqueItemIds.map((itemId, index) => {
    const sortOrder = (index + 1) * 1000;
    return supabase
      .from("routine_items")
      .update({ sort_order: sortOrder })
      .eq("organization_id", organization.id)
      .eq("daily_checklist_item_id", itemId);
  }));

  return NextResponse.json({ ok: true });
}
