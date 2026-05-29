import { LibraryFileActions } from "@/components/files/library-file-actions";
import { LibraryUploadModal } from "@/components/files/library-upload-modal";
import { ProfessionalDocumentsPanel } from "@/components/documents/professional-documents-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { data } = await supabase
    .from("document_templates")
    .select("*")
    .or(`organization_id.eq.${organization.id},is_global.eq.true`)
    .order("updated_at", { ascending: false });
  const documents = data ?? [];

  const normalized = q.trim().toLowerCase();
  const filtered = normalized
    ? documents.filter((document) =>
        [document.title, document.category, document.description]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized)),
      )
    : documents;

  return (
    <div>
      <PageHeader title="Biblioteca de documentos" description="Modelos e documentos operacionais versionados.">
        <LibraryUploadModal kind="document" />
      </PageHeader>
      <div className="grid gap-6">
        <ProfessionalDocumentsPanel
          title="Documentos profissionais da empresa"
          relatedType="company"
        />

        <Card>
          <CardHeader>
            <CardTitle>Documentos</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="mb-4">
              <Input name="q" defaultValue={q} placeholder="Buscar por titulo, categoria ou descricao" />
            </form>
            {filtered.length ? (
              <div className="space-y-3">
                {filtered.map((document) => (
                  <div key={document.id} className="rounded-lg border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{document.title}</h2>
                        <p className="text-sm text-muted-foreground">{document.description}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="secondary">{document.category}</Badge>
                          <Badge variant="outline">v{document.version}</Badge>
                          <Badge variant={document.status === "vigente" ? "default" : "destructive"}>
                            {document.status}
                          </Badge>
                          <Badge variant={document.is_global ? "outline" : "secondary"}>
                            {document.is_global ? "Global/Oficial" : "Empresa"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {document.file_name ?? document.storage_path ?? "Sem arquivo anexado"}
                        </p>
                      </div>
                      <LibraryFileActions
                        id={document.id}
                        kind="document"
                        fileName={document.file_name}
                        mimeType={document.mime_type}
                        canDelete={!document.is_global && document.organization_id === organization.id}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum documento encontrado." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
