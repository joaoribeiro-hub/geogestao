import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createCompanyKnowledgeBlockAction,
  createCompanyKnowledgeChecklistItemAction,
  deleteCompanyKnowledgeBlockAction,
  deleteCompanyKnowledgeChecklistItemAction,
  toggleCompanyKnowledgeChecklistItemAction,
  updateCompanyKnowledgeBlockAction,
  updateCompanyKnowledgeItemAction,
} from "@/app/(app)/minha-empresa/actions";
import { DeleteButton } from "@/components/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ModalDisclosure } from "@/components/ui/modal-disclosure";
import { requireUser } from "@/lib/auth";
import { getCompanyKnowledgeStatusLabel } from "@/lib/company-knowledge";
import { canManageOrganization, getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn, formatDate } from "@/lib/utils";

export default async function CompanyKnowledgePage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  if (!context.organization || !context.membership) notFound();
  const organizationId = context.organization.id;
  const canEdit = canManageOrganization({ profile: context.profile, membership: context.membership });

  const [{ data: item }, { data: blocks }, { data: checklist }, { data: categories }] = await Promise.all([
    supabase
      .from("company_knowledge_items")
      .select("*")
      .eq("id", pageId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("company_knowledge_blocks")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("item_id", pageId)
      .order("position"),
    supabase
      .from("company_knowledge_checklist_items")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("knowledge_item_id", pageId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("company_knowledge_categories")
      .select("*")
      .eq("organization_id", organizationId)
      .order("position"),
  ]);
  if (!item) notFound();

  const userIds = Array.from(new Set([item.created_by, item.updated_by].filter(Boolean))) as string[];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const category = (categories ?? []).find((entry) => entry.id === item.category_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href="/minha-empresa?tab=informacoes">Voltar</Link>
          </Button>
          <h1 className="mt-4 text-2xl font-semibold tracking-normal">{item.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{category?.name ?? "Base interna"}</Badge>
            <Badge>{getCompanyKnowledgeStatusLabel(item.status)}</Badge>
            <span>Criado por {profileMap.get(item.created_by ?? "")?.full_name ?? "Nao informado"}</span>
            <span>Ultima edicao {formatDate(item.updated_at ?? item.created_at)}</span>
            <span>Editor {profileMap.get(item.updated_by ?? "")?.full_name ?? "Nao informado"}</span>
          </div>
        </div>
        {canEdit ? (
          <ModalDisclosure
            title="Editar pagina"
            description="Atualize titulo, status e conteudo principal."
            trigger={<Button type="button">Editar</Button>}
          >
            <form
              action={async (formData) => {
                "use server";
                await updateCompanyKnowledgeItemAction(item.id, formData);
              }}
              className="grid gap-3"
            >
              <input type="hidden" name="category_id" value={item.category_id ?? ""} />
              <Field label="Titulo">
                <Input name="title" defaultValue={item.title} required />
              </Field>
              <Field label="Status">
                <select name="status" defaultValue={item.status} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="nao_iniciada">Nao iniciada</option>
                  <option value="em_desenvolvimento">Em desenvolvimento</option>
                  <option value="em_revisao">Em revisao</option>
                  <option value="atualizado">Atualizado</option>
                </select>
              </Field>
              <Field label="Descricao">
                <textarea name="description" defaultValue={item.description ?? ""} className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Conteudo markdown">
                <textarea name="content_markdown" defaultValue={item.content_markdown ?? ""} className="min-h-72 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm" />
              </Field>
              <Button type="submit">Salvar</Button>
            </form>
          </ModalDisclosure>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conteudo</CardTitle>
        </CardHeader>
        <CardContent>
          {item.content_markdown?.trim() ? (
            <div className="rounded-md border bg-background p-4 text-sm leading-6 whitespace-pre-wrap">
              {item.content_markdown}
            </div>
          ) : (
            <EmptyState title="Esta pagina ainda nao possui conteudo." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Blocos personalizados</CardTitle>
          {canEdit ? (
            <ModalDisclosure
              title="Adicionar bloco"
              trigger={<Button type="button" size="sm" variant="outline">+ Adicionar bloco</Button>}
            >
              <form action={createCompanyKnowledgeBlockAction} className="grid gap-3">
                <input type="hidden" name="item_id" value={item.id} />
                <Field label="Titulo">
                  <Input name="title" required />
                </Field>
                <Field label="Conteudo">
                  <textarea name="content" className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </Field>
                <Button type="submit">Adicionar bloco</Button>
              </form>
            </ModalDisclosure>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {blocks?.length ? (
            blocks.map((block) => (
              <form
                key={block.id}
                action={async (formData) => {
                  "use server";
                  await updateCompanyKnowledgeBlockAction(block.id, formData);
                }}
                className="space-y-3 rounded-md border bg-background p-4"
              >
                <input type="hidden" name="item_id" value={item.id} />
                <Input name="title" defaultValue={block.title} disabled={!canEdit} required />
                <textarea name="content" defaultValue={block.content ?? ""} disabled={!canEdit} className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-70" />
                {canEdit ? (
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Salvar bloco</Button>
                    <DeleteButton
                      label="Apagar"
                      confirmMessage="Apagar este bloco?"
                      action={async () => {
                        "use server";
                        await deleteCompanyKnowledgeBlockAction(block.id);
                      }}
                    />
                  </div>
                ) : null}
              </form>
            ))
          ) : (
            <EmptyState title="Nenhum bloco personalizado." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checklist da pagina</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklist?.length ? (
            checklist.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
                <div>
                  <p className={cn("font-medium", entry.is_done && "line-through text-muted-foreground")}>{entry.title}</p>
                  <p className="text-xs text-muted-foreground">{entry.due_date ? formatDate(entry.due_date) : "Sem data"}</p>
                </div>
                {canEdit ? (
                  <div className="flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await toggleCompanyKnowledgeChecklistItemAction(entry.id, !entry.is_done);
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline">{entry.is_done ? "Reabrir" : "Concluir"}</Button>
                    </form>
                    <DeleteButton
                      label="Apagar"
                      confirmMessage="Apagar este item?"
                      action={async () => {
                        "use server";
                        await deleteCompanyKnowledgeChecklistItemAction(entry.id);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState title="Nenhum item no checklist." />
          )}
          {canEdit ? (
            <ModalDisclosure
              title="Adicionar item ao checklist"
              trigger={<Button type="button" variant="outline">+ Adicionar item</Button>}
            >
              <form action={createCompanyKnowledgeChecklistItemAction} className="grid gap-3">
                <input type="hidden" name="knowledge_item_id" value={item.id} />
                <Field label="Item">
                  <Input name="title" required />
                </Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Data">
                    <Input type="date" name="due_date" />
                  </Field>
                  <Field label="Horario">
                    <Input type="time" name="due_time" />
                  </Field>
                </div>
                <Button type="submit">Adicionar</Button>
              </form>
            </ModalDisclosure>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

