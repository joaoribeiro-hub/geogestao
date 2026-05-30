import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import {
  mapTrelloRowsToServices,
  parseTrelloImportFile,
  rawImportData,
} from "@/lib/services/trello-import";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json, ProposalServiceType } from "@/types/database";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const formData = await request.formData();
  const file = formData.get("file");
  const boardId = typeof formData.get("boardId") === "string" ? String(formData.get("boardId")) : null;
  const dryRun = formData.get("dryRun") !== "false";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie uma planilha .xlsx ou .csv." }, { status: 400 });
  }
  if (!boardId) return NextResponse.json({ error: "Quadro de servico nao informado." }, { status: 400 });

  const [{ data: board }, { data: columns }] = await Promise.all([
    supabase.from("service_boards").select("id,slug").eq("id", boardId).maybeSingle(),
    supabase.from("service_columns").select("id,name,slug,board_id").eq("board_id", boardId).order("position"),
  ]);
  if (!board || !columns?.length) {
    return NextResponse.json({ error: "Quadro ou colunas de servico nao encontrados." }, { status: 400 });
  }

  try {
    const rows = await parseTrelloImportFile(file.name, Buffer.from(await file.arrayBuffer()));
    const mapped = mapTrelloRowsToServices(rows, columns);
    const externalIds = mapped.map((row) => row.externalId).filter(Boolean) as string[];
    const [{ data: existing }, { data: existingImported }] = await Promise.all([
      externalIds.length
        ? supabase
            .from("service_cards")
            .select("import_external_id")
            .eq("organization_id", organization.id)
            .eq("import_source", "trello")
            .in("import_external_id", externalIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("service_cards")
        .select("title,description")
        .eq("organization_id", organization.id)
        .eq("import_source", "trello"),
    ]);
    const duplicateIds = new Set((existing ?? []).map((row) => row.import_external_id).filter(Boolean));
    const duplicateFingerprints = new Set(
      (existingImported ?? []).map((row) => `${row.title.trim().toLowerCase()}::${(row.description ?? "").trim().toLowerCase()}`),
    );
    const preview = mapped.map((row) => {
      const fingerprint = `${row.title.trim().toLowerCase()}::${(row.description ?? "").trim().toLowerCase()}`;
      return { ...row, duplicate: row.externalId ? duplicateIds.has(row.externalId) : duplicateFingerprints.has(fingerprint) };
    });
    const importable = preview.filter((row) => !row.duplicate);

    const { data: batch } = await supabase
      .from("service_import_batches")
      .insert({
        organization_id: organization.id,
        uploaded_by: user.id,
        source: "trello",
        filename: file.name,
        total_rows: rows.length,
        imported_count: dryRun ? 0 : importable.length,
        skipped_count: preview.length - importable.length,
        error_count: 0,
        dry_run: dryRun,
      })
      .select("id")
      .single();

    if (!dryRun && importable.length) {
      const now = new Date().toISOString();
      const serviceType = serviceTypeFromBoardSlug(board.slug);
      const { error: insertError } = await supabase.from("service_cards").insert(
        importable.map((row, index) => ({
          organization_id: organization.id,
          column_id: row.columnId,
          owner_id: user.id,
          client_id: null,
          title: row.title,
          description: row.description,
          priority: row.priority,
          due_date: row.dueDate,
          service_date: row.serviceDate,
          service_type: serviceType,
          payment_status: "pagamento_nao_efetuado" as const,
          position: index,
          import_source: "trello",
          import_external_id: row.externalId,
          import_external_url: row.externalUrl,
          imported_at: now,
          imported_by: user.id,
          raw_import_data: rawImportData(row.raw) as Json,
          custom_fields_json: {
            trello_labels: row.labels,
            trello_list_name: row.listName,
            trello_card_status: row.sourceLabels,
            import_batch_id: batch?.id ?? null,
          } as Json,
        })),
      );
      if (insertError) throw new Error(insertError.message);
    }

    return NextResponse.json({
      batchId: batch?.id,
      totalRows: rows.length,
      importableCount: importable.length,
      duplicateCount: preview.length - importable.length,
      preview: preview.slice(0, 10).map((row) => ({
        externalId: row.externalId,
        title: row.title,
        description: row.description?.slice(0, 180) ?? null,
        listName: row.listName,
        columnName: row.columnName,
        priority: row.priority,
        labels: row.sourceLabels,
        dueDate: row.dueDate,
        duplicate: row.duplicate,
        fallback: /aguard|document/.test(row.columnName.toLowerCase()) && !/aguard|document/.test((row.sourceLabels ?? "").toLowerCase()),
      })),
      importedCount: dryRun ? 0 : importable.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel importar a planilha." },
      { status: 500 },
    );
  }
}

function serviceTypeFromBoardSlug(slug: string): ProposalServiceType {
  if (slug === "car") return "car";
  if (slug === "itr-ccir") return "itr_ccir";
  if (slug === "outros-servicos") return "outros_servicos";
  return "georreferenciamento";
}
