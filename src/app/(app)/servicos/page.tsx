import Link from "next/link";
import { ServiceCardForm } from "@/components/forms/service-card-form";
import { ServiceKanban } from "@/components/kanban/service-kanban";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const { board } = await searchParams;
  const supabase = await createServerSupabase();
  const [boardsResult, clientsResult] = await Promise.all([
    supabase.from("service_boards").select("*").order("position"),
    supabase.from("clients").select("*").order("name"),
  ]);
  const boards = boardsResult.data ?? [];
  const clients = clientsResult.data ?? [];

  const selectedBoard = boards.find((item) => item.slug === board) ?? boards[0];
  const columnsResult = selectedBoard
    ? await supabase
        .from("service_columns")
        .select("*")
        .eq("board_id", selectedBoard.id)
        .order("position")
    : { data: [] };
  const columns = columnsResult.data ?? [];

  const columnIds = columns.map((column) => column.id);
  const cardsResult = columnIds.length
    ? await supabase.from("service_cards").select("*").in("column_id", columnIds)
    : { data: [] };
  const cards = cardsResult.data ?? [];

  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const cardsWithClients = cards.map((card) => ({
    ...card,
    client: card.client_id ? clientMap.get(card.client_id) ?? null : null,
  }));

  return (
    <div>
      <PageHeader
        title="Servicos tecnicos"
        description="Quadros flexiveis para GEO, CAR, ITR/CCIR e demais demandas."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {boards.map((item) => (
          <Link
            key={item.id}
            href={`/servicos?board=${item.slug}`}
            className={cn(
              "rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground",
              selectedBoard?.id === item.id && "border-primary text-primary",
            )}
          >
            {item.name}
          </Link>
        ))}
      </div>

      {!selectedBoard ? (
        <EmptyState title="Execute o seed para criar os quadros padrao." />
      ) : (
        <div className="grid gap-6 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Novo card</CardTitle>
            </CardHeader>
            <CardContent>
              <ServiceCardForm clients={clients} columns={columns} />
            </CardContent>
          </Card>
          <ServiceKanban columns={columns} cards={cardsWithClients} />
        </div>
      )}
    </div>
  );
}
