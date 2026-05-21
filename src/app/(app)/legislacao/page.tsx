import Link from "next/link";
import { LibraryFileActions } from "@/components/files/library-file-actions";
import { LibraryUploadModal } from "@/components/files/library-upload-modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function LegislationPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { data } = await supabase
    .from("legislation_items")
    .select("*")
    .or(`organization_id.eq.${organization.id},is_global.eq.true`)
    .order("updated_at", { ascending: false });
  const items = data ?? [];

  const normalized = q.trim().toLowerCase();
  const filtered = normalized
    ? items.filter((item) =>
        [item.title, item.category, item.technical_summary, item.practical_points]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized)),
      )
    : items;

  return (
    <div>
      <PageHeader title="Biblioteca de legislacao" description="Normas, links oficiais e observacoes praticas para consulta tecnica.">
        <LibraryUploadModal kind="legislation" />
      </PageHeader>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Legislacao</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="mb-4">
              <Input name="q" defaultValue={q} placeholder="Buscar por palavra-chave" />
            </form>
            {filtered.length ? (
              <div className="space-y-3">
                {filtered.map((item) => (
                  <div key={item.id} className="rounded-lg border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{item.title}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{item.technical_summary}</p>
                        <p className="mt-2 text-sm">{item.practical_points}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="secondary">{item.category}</Badge>
                          <Badge variant={item.status === "vigente" ? "default" : "outline"}>{item.status}</Badge>
                          <Badge variant={item.is_global ? "outline" : "secondary"}>
                            {item.is_global ? "Global/Oficial" : "Empresa"}
                          </Badge>
                          {item.official_link ? (
                            <Link className="text-sm font-medium text-primary hover:underline" href={item.official_link} target="_blank">
                              Link oficial
                            </Link>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {item.file_name ?? item.storage_path ?? "Sem arquivo anexado"}
                        </p>
                      </div>
                      <LibraryFileActions
                        id={item.id}
                        kind="legislation"
                        fileName={item.file_name}
                        mimeType={item.mime_type}
                        canDelete={!item.is_global && item.organization_id === organization.id}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhuma legislacao encontrada." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
