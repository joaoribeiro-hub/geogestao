import { DeleteButton } from "@/components/delete-button";
import { DocumentTemplateForm } from "@/components/forms/document-template-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { deleteDocumentTemplateAction } from "@/app/(app)/documentos/actions";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("document_templates")
    .select("*")
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
      <PageHeader title="Biblioteca de documentos" description="Modelos e documentos operacionais versionados." />
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Novo documento</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentTemplateForm />
          </CardContent>
        </Card>
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
                        </div>
                      </div>
                      <DeleteButton
                        label="Excluir"
                        confirmMessage="Excluir este documento?"
                        action={async () => {
                          "use server";
                          await deleteDocumentTemplateAction(document.id);
                        }}
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
