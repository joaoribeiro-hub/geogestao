import { notFound } from "next/navigation";
import {
  ChecklistForm,
  ChecklistItemForm,
  ChecklistToggle,
} from "@/components/forms/checklist-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: card } = await supabase.from("service_cards").select("*").eq("id", id).single();
  if (!card) notFound();

  const [
    { data: client },
    { data: column },
    checklistsResult,
    movementsResult,
  ] = await Promise.all([
    card.client_id
      ? supabase.from("clients").select("*").eq("id", card.client_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("service_columns").select("*").eq("id", card.column_id).single(),
    supabase.from("checklists").select("*").eq("service_card_id", card.id).order("position"),
    supabase
      .from("service_card_movements")
      .select("*")
      .eq("service_card_id", card.id)
      .order("created_at", { ascending: false }),
  ]);
  const checklists = checklistsResult.data ?? [];
  const movements = movementsResult.data ?? [];

  const checklistIds = checklists.map((checklist) => checklist.id);
  const itemsResult = checklistIds.length
    ? await supabase.from("checklist_items").select("*").in("checklist_id", checklistIds).order("position")
    : { data: [] };
  const items = itemsResult.data ?? [];

  return (
    <div>
      <PageHeader title={card.title} description={client?.name ?? "Servico sem cliente vinculado"} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo tecnico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{column?.name ?? "Sem coluna"}</Badge>
                <Badge variant="outline">Prioridade {card.priority}</Badge>
                <Badge variant="outline">{Number(card.checklist_percent).toFixed(0)}% concluido</Badge>
              </div>
              <p className="text-muted-foreground">{card.description ?? "Sem descricao."}</p>
              <p>
                <span className="font-medium">Data prevista:</span> {formatDate(card.due_date)}
              </p>
              <pre className="overflow-auto rounded-md bg-secondary p-3 text-xs">
                {JSON.stringify(card.custom_fields_json, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklists</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ChecklistForm serviceCardId={card.id} />
              {checklists.length ? (
                checklists.map((checklist) => {
                  const checklistItems = items.filter(
                    (item) => item.checklist_id === checklist.id,
                  );
                  return (
                    <div key={checklist.id} className="rounded-lg border p-4">
                      <h2 className="mb-3 text-sm font-semibold">{checklist.title}</h2>
                      <div className="mb-3 space-y-2">
                        {checklistItems.map((item) => (
                          <ChecklistToggle
                            key={item.id}
                            itemId={item.id}
                            checklistId={checklist.id}
                            checked={item.is_done}
                            label={item.title}
                          />
                        ))}
                      </div>
                      <ChecklistItemForm checklistId={checklist.id} />
                    </div>
                  );
                })
              ) : (
                <EmptyState title="Nenhum checklist cadastrado." />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Movimentacoes</CardTitle>
          </CardHeader>
          <CardContent>
            {movements.length ? (
              <div className="space-y-3">
                {movements.map((movement) => (
                  <div key={movement.id} className="rounded-md border bg-background p-3 text-sm">
                    <p className="text-muted-foreground">{formatDate(movement.created_at)}</p>
                    <p>Movido para a coluna {movement.to_column_id}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Sem movimentacoes registradas." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
