import { createClient } from "@supabase/supabase-js";

type Args = {
  organizationId?: string;
  slug?: string;
  confirm: boolean;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!args.organizationId && !args.slug) {
    throw new Error("Informe --organization-id=<id> ou --slug=<slug>.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const organization = await resolveOrganization();
  const counts = await collectCounts(organization.id);

  console.log(`Organizacao: ${organization.name} (${organization.id})`);
  console.log(args.confirm ? "Modo: CONFIRMADO" : "Modo: DRY-RUN");
  console.table(counts);

  if (!args.confirm) {
    console.log("Nenhum dado foi apagado. Rode novamente com --confirm para executar.");
    return;
  }

  await deleteOperationalData(organization.id);
  console.log("Reset operacional concluido.");

  async function resolveOrganization() {
    const query = supabase.from("organizations").select("id,name,slug").limit(1);
    const { data, error } = args.organizationId
      ? await query.eq("id", args.organizationId)
      : await query.eq("slug", args.slug!);
    if (error) throw new Error(error.message);
    const organization = data?.[0];
    if (!organization) throw new Error("Organizacao nao encontrada.");
    return organization;
  }

  async function collectCounts(organizationId: string) {
    const serviceCardIds = await ids("service_cards", organizationId);
    const checklistIds = serviceCardIds.length
      ? await idsByForeignKey("checklists", "service_card_id", serviceCardIds)
      : [];

    return [
      await count("clients", organizationId),
      await count("client_interactions", organizationId),
      await count("proposals", organizationId),
      await count("contracts", organizationId),
      await count("service_cards", organizationId),
      { table: "checklists", count: checklistIds.length },
      {
        table: "checklist_items",
        count: checklistIds.length
          ? await countByForeignKey("checklist_items", "checklist_id", checklistIds)
          : 0,
      },
      {
        table: "service_card_movements",
        count: serviceCardIds.length
          ? await countByForeignKey("service_card_movements", "service_card_id", serviceCardIds)
          : 0,
      },
      await count("service_members", organizationId),
      await count("service_events", organizationId),
      await count("team_members", organizationId),
      await count("recurring_expenses", organizationId),
      await count("revenues", organizationId),
      await count("expenses", organizationId),
      await count("attachments", organizationId),
      await count("document_templates", organizationId),
      await count("legislation_items", organizationId),
      await count("properties", organizationId),
      await count("property_geometries", organizationId),
    ];
  }

  async function deleteOperationalData(organizationId: string) {
    const serviceCardIds = await ids("service_cards", organizationId);
    const checklistIds = serviceCardIds.length
      ? await idsByForeignKey("checklists", "service_card_id", serviceCardIds)
      : [];

    if (checklistIds.length) await deleteByForeignKey("checklist_items", "checklist_id", checklistIds);
    if (serviceCardIds.length) {
      await deleteByForeignKey("service_card_movements", "service_card_id", serviceCardIds);
      await deleteByForeignKey("checklists", "service_card_id", serviceCardIds);
    }

    for (const table of [
      "service_events",
      "service_members",
      "attachments",
      "property_geometries",
      "properties",
      "revenues",
      "expenses",
      "recurring_expenses",
      "team_members",
      "contracts",
      "proposals",
      "service_cards",
      "client_interactions",
      "document_templates",
      "legislation_items",
      "clients",
    ]) {
      const { error } = await supabase.from(table).delete().eq("organization_id", organizationId);
      if (error && !isMissingRelation(error.message)) throw new Error(`${table}: ${error.message}`);
    }
  }

  async function count(table: string, organizationId: string) {
    const { count: total, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId);
    if (error && isMissingRelation(error.message)) return { table, count: 0 };
    if (error) throw new Error(`${table}: ${error.message}`);
    return { table, count: total ?? 0 };
  }

  async function ids(table: string, organizationId: string) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("organization_id", organizationId);
    if (error && isMissingRelation(error.message)) return [];
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []).map((row) => row.id as string);
  }

  async function idsByForeignKey(table: string, column: string, values: string[]) {
    const { data, error } = await supabase.from(table).select("id").in(column, values);
    if (error && isMissingRelation(error.message)) return [];
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []).map((row) => row.id as string);
  }

  async function countByForeignKey(table: string, column: string, values: string[]) {
    const { count: total, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .in(column, values);
    if (error && isMissingRelation(error.message)) return 0;
    if (error) throw new Error(`${table}: ${error.message}`);
    return total ?? 0;
  }

  async function deleteByForeignKey(table: string, column: string, values: string[]) {
    const { error } = await supabase.from(table).delete().in(column, values);
    if (error && !isMissingRelation(error.message)) throw new Error(`${table}: ${error.message}`);
  }
}

function parseArgs(rawArgs: string[]): Args {
  return rawArgs.reduce<Args>(
    (acc, item) => {
      if (item === "--confirm") return { ...acc, confirm: true };
      if (item.startsWith("--organization-id=")) {
        return { ...acc, organizationId: item.split("=")[1] };
      }
      if (item.startsWith("--slug=")) return { ...acc, slug: item.split("=")[1] };
      return acc;
    },
    { confirm: false },
  );
}

function isMissingRelation(message: string) {
  return /relation .* does not exist/i.test(message) || /Could not find the table/i.test(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
