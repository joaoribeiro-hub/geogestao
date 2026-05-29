import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Search } from "lucide-react";
import {
  createCompanyKnowledgeBlockAction,
  createCompanyKnowledgeCategoryAction,
  createCompanyKnowledgeChecklistItemAction,
  createCompanyKnowledgeItemAction,
  createHrAbsenceAction,
  createHrBirthdayAction,
  createHrDocumentWithUploadAction,
  deleteCompanyKnowledgeBlockAction,
  deleteCompanyKnowledgeChecklistItemAction,
  deleteHrAbsenceAction,
  deleteHrBirthdayAction,
  deleteHrDocumentAction,
  deleteTeamMemberAction,
  toggleCompanyKnowledgeChecklistItemAction,
  updateCompanyKnowledgeBlockAction,
  updateHrDocumentAction,
  updateCompanyKnowledgeItemAction,
} from "@/app/(app)/minha-empresa/actions";
import { TeamMemberModal } from "@/components/company/team-member-modal";
import { CompanyJoinCode } from "@/components/company/company-join-code";
import { ClientCreateModal } from "@/components/clients/client-create-modal";
import { DeleteButton } from "@/components/delete-button";
import { CompanyBankForm } from "@/components/forms/company-bank-form";
import { CompanyInfoForm } from "@/components/forms/company-info-form";
import { CompanyServiceForm } from "@/components/forms/company-service-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ModalDisclosure } from "@/components/ui/modal-disclosure";
import { requireUser } from "@/lib/auth";
import { getCompanyKnowledgeStatusLabel } from "@/lib/company-knowledge";
import {
  canManageOrganization,
  canViewOrganizationSettings,
  getCurrentOrganizationForUser,
  getCurrentProfile,
  getOrganizationMembershipForUser,
} from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const tabs = [
  { id: "informacoes", label: "Informacoes" },
  { id: "rh", label: "RH" },
  { id: "clientes", label: "Clientes" },
  { id: "variaveis-financeiras", label: "Variaveis financeiras" },
  { id: "documentos-internos", label: "Documentos internos" },
  { id: "servicos-nichos", label: "Servicos e nichos" },
  { id: "opcoes-propostas", label: "Opcoes de propostas" },
  { id: "opcoes-contratos", label: "Opcoes de contratos" },
  { id: "bancos", label: "Bancos" },
  { id: "armazenamento", label: "Armazenamento" },
] as const;

type CompanyTab = (typeof tabs)[number]["id"];

export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    knowledge?: string;
    birthdaysMonth?: string;
    absencesMonth?: string;
  }>;
}) {
  const {
    tab = "informacoes",
    q = "",
    knowledge,
    birthdaysMonth,
    absencesMonth,
  } = await searchParams;
  const activeTab = tabs.some((item) => item.id === tab)
    ? (tab as CompanyTab)
    : "informacoes";
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const [profile, membership] = await Promise.all([
    getCurrentProfile(supabase, user.id),
    getOrganizationMembershipForUser(supabase, organization.id, user.id),
  ]);
  const canEditCompany = canManageOrganization({ profile, membership });
  const canViewCompanySettings = canViewOrganizationSettings({ membership });
  const { data: joinCode } = canEditCompany
    ? await supabase
        .from("organization_join_codes")
        .select("code")
        .eq("organization_id", organization.id)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };

  return (
    <div>
      <PageHeader
        title="Minha Empresa"
        description="Configuracoes e cadastros internos do escritorio."
      />

      <nav className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/minha-empresa?tab=${item.id}`}
            className={cn(
              "rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground",
              activeTab === item.id && "border-primary text-primary",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {canEditCompany && joinCode?.code ? (
        <div className="mb-6">
          <CompanyJoinCode code={joinCode.code} />
        </div>
      ) : null}

      {activeTab === "informacoes" ? (
        <CompanyInfoSection
          organizationId={organization.id}
          canEdit={canEditCompany}
          canView={canViewCompanySettings}
          selectedKnowledgeId={knowledge}
        />
      ) : null}
      {activeTab === "rh" ? (
        <CompanyRhSection
          organizationId={organization.id}
          canEdit={canEditCompany}
          canView={canViewCompanySettings}
          birthdaysMonth={birthdaysMonth}
          absencesMonth={absencesMonth}
        />
      ) : null}
      {activeTab === "clientes" ? (
        <CompanyClientsSection q={q} organizationId={organization.id} />
      ) : null}
      {activeTab === "variaveis-financeiras" ? (
        <CompanyFinancialSection
          organizationId={organization.id}
          canEdit={canEditCompany}
          canView={canViewCompanySettings}
        />
      ) : null}
      {activeTab === "servicos-nichos" ? (
        <CompanyServicesSection
          organizationId={organization.id}
          canEdit={canEditCompany}
          canView={canViewCompanySettings}
        />
      ) : null}
      {activeTab !== "informacoes" &&
      activeTab !== "rh" &&
      activeTab !== "clientes" &&
      activeTab !== "variaveis-financeiras" &&
      activeTab !== "servicos-nichos" ? (
        <ComingSoonSection label={tabs.find((item) => item.id === activeTab)?.label ?? ""} />
      ) : null}
    </div>
  );
}

async function CompanyInfoSection({
  organizationId,
  canEdit,
  canView,
  selectedKnowledgeId,
}: {
  organizationId: string;
  canEdit: boolean;
  canView: boolean;
  selectedKnowledgeId?: string;
}) {
  if (!canView) return <CompanySettingsRestrictedSection />;

  const supabase = await createServerSupabase();
  const [settingsResult, categoriesResult, itemsResult, selectedItemResult, blocksResult, checklistResult] =
    await Promise.all([
    supabase
      .from("company_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("singleton_key", "default")
      .maybeSingle(),
    supabase
      .from("company_knowledge_categories")
      .select("*")
      .eq("organization_id", organizationId)
      .order("position"),
    supabase
      .from("company_knowledge_items")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    selectedKnowledgeId
      ? supabase
          .from("company_knowledge_items")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("id", selectedKnowledgeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    selectedKnowledgeId
      ? supabase
          .from("company_knowledge_blocks")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("item_id", selectedKnowledgeId)
          .order("position")
      : Promise.resolve({ data: [] }),
    selectedKnowledgeId
      ? supabase
          .from("company_knowledge_checklist_items")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("knowledge_item_id", selectedKnowledgeId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const settings = settingsResult.data;
  const categories = categoriesResult.data ?? [];
  const knowledgeItems = itemsResult.data ?? [];
  const selectedItem = selectedItemResult.data;
  const selectedBlocks = blocksResult.data ?? [];
  const selectedChecklist = checklistResult.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informacoes da empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyInfoForm settings={settings} canEdit={canEdit} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Bases internas da empresa</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Regras, cultura, acessos, reunioes e hierarquia para consulta operacional.
              </p>
            </div>
            {canEdit ? (
              <ModalDisclosure
                title="Novo eixo"
                description="Crie uma nova categoria para a base interna da empresa."
                trigger={<Button type="button" variant="outline">+ Novo eixo</Button>}
              >
                <form action={createCompanyKnowledgeCategoryAction} className="grid gap-3">
                  <Field label="Nome do eixo">
                    <Input name="name" required placeholder="Ex.: Processos Comerciais" />
                  </Field>
                  <Button type="submit">Criar eixo</Button>
                </form>
              </ModalDisclosure>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {categories.length ? (
            <div className="space-y-5">
              {categories.map((category) => {
                const items = knowledgeItems.filter((item) => item.category_id === category.id);
                return (
                  <section key={category.id} className="rounded-md border bg-background p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">
                        {category.name} <span className="text-muted-foreground">{items.length}</span>
                      </h3>
                      {canEdit ? (
                        <ModalDisclosure
                          title={`Nova pagina - ${category.name}`}
                          description="Crie uma pagina dentro deste eixo."
                          trigger={<Button type="button" size="sm" variant="outline">+ Nova pagina</Button>}
                        >
                          <form action={createCompanyKnowledgeItemAction} className="grid gap-3">
                            <input type="hidden" name="category_id" value={category.id} />
                            <Field label="Titulo">
                              <Input name="title" placeholder="Nova pagina" required />
                            </Field>
                            <Field label="Status inicial">
                              <select name="status" defaultValue="nao_iniciada" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                                <option value="nao_iniciada">Nao iniciada</option>
                                <option value="em_desenvolvimento">Em desenvolvimento</option>
                                <option value="em_revisao">Em revisao</option>
                                <option value="atualizado">Atualizado</option>
                              </select>
                            </Field>
                            <Field label="Descricao inicial">
                              <textarea
                                name="description"
                                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </Field>
                            <Button type="submit">Criar pagina</Button>
                          </form>
                        </ModalDisclosure>
                      ) : null}
                    </div>
                    <div className="divide-y rounded-md border">
                      {items.length ? (
                        items.map((item) => (
                          <Link
                            key={item.id}
                            href={`/minha-empresa/base-interna/${item.id}`}
                            className="grid gap-2 bg-card px-3 py-3 text-sm hover:bg-secondary/70 md:grid-cols-[minmax(0,1fr)_170px_150px]"
                          >
                            <span className="font-medium">&gt; {item.title}</span>
                            <Badge variant="outline" className="w-fit">
                              {getCompanyKnowledgeStatusLabel(item.status)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(item.updated_at ?? item.created_at)}
                            </span>
                          </Link>
                        ))
                      ) : (
                        <p className="p-3 text-sm text-muted-foreground">Nenhuma pagina cadastrada.</p>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <EmptyState title="As categorias internas serao criadas ao rodar a migration." />
          )}
        </CardContent>
      </Card>
      {selectedItem ? (
        <Card>
          <CardHeader>
            <CardTitle>Detalhe da base interna</CardTitle>
            <p className="text-sm text-muted-foreground">
              Conteudo operacional visivel para a equipe. Apenas owner edita.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              action={async (formData) => {
                "use server";
                await updateCompanyKnowledgeItemAction(selectedItem.id, formData);
              }}
              className="grid gap-3 rounded-md border bg-background p-4 md:grid-cols-2"
            >
              <input type="hidden" name="category_id" value={selectedItem.category_id ?? ""} />
              <Field label="Titulo">
                <Input name="title" defaultValue={selectedItem.title} disabled={!canEdit} required />
              </Field>
              <Field label="Status">
                <Input name="status" defaultValue={selectedItem.status ?? "active"} disabled={!canEdit} required />
              </Field>
              <div className="md:col-span-2">
                <Field label="Descricao principal">
                  <textarea
                    name="description"
                    defaultValue={selectedItem.description ?? ""}
                    disabled={!canEdit}
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                  />
                </Field>
              </div>
              {canEdit ? (
                <div className="md:col-span-2">
                  <Button type="submit">Salvar item</Button>
                </div>
              ) : null}
            </form>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Blocos personalizados</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {selectedBlocks.map((block) => (
                  <form
                    key={block.id}
                    action={async (formData) => {
                      "use server";
                      await updateCompanyKnowledgeBlockAction(block.id, formData);
                    }}
                    className="space-y-3 rounded-md border bg-background p-4"
                  >
                    <input type="hidden" name="item_id" value={selectedItem.id} />
                    <Input name="title" defaultValue={block.title} disabled={!canEdit} required />
                    <textarea
                      name="content"
                      defaultValue={block.content ?? ""}
                      disabled={!canEdit}
                      className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    />
                    {canEdit ? (
                      <div className="flex gap-2">
                        <Button size="sm" type="submit">Salvar bloco</Button>
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
                ))}
                {canEdit ? (
                  <form action={createCompanyKnowledgeBlockAction} className="space-y-3 rounded-md border border-dashed bg-background p-4">
                    <input type="hidden" name="item_id" value={selectedItem.id} />
                    <Input name="title" placeholder="Titulo do bloco" required />
                    <textarea
                      name="content"
                      placeholder="Conteudo do bloco"
                      className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button size="sm" type="submit">Adicionar bloco</Button>
                  </form>
                ) : null}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold">Checklist do item</h3>
              <div className="space-y-2">
                {selectedChecklist.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
                    <div>
                      <p className={cn("font-medium", item.is_done && "line-through text-muted-foreground")}>{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.due_date ? `Data: ${formatDate(item.due_date)}` : "Sem data"}
                        {item.due_time ? ` as ${item.due_time.slice(0, 5)}` : ""}
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="flex gap-2">
                        <form
                          action={async () => {
                            "use server";
                            await toggleCompanyKnowledgeChecklistItemAction(item.id, !item.is_done);
                          }}
                        >
                          <Button type="submit" size="sm" variant="outline">
                            {item.is_done ? "Reabrir" : "Concluir"}
                          </Button>
                        </form>
                        <DeleteButton
                          label="Apagar"
                          confirmMessage="Apagar este item?"
                          action={async () => {
                            "use server";
                            await deleteCompanyKnowledgeChecklistItemAction(item.id);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
                {!selectedChecklist.length ? (
                  <EmptyState title="Nenhum item de checklist cadastrado." />
                ) : null}
              </div>
              {canEdit ? (
                <form action={createCompanyKnowledgeChecklistItemAction} className="mt-3 grid gap-3 rounded-md border border-dashed bg-background p-4 md:grid-cols-[1fr_160px_140px_auto]">
                  <input type="hidden" name="knowledge_item_id" value={selectedItem.id} />
                  <Input name="title" placeholder="Novo item de checklist" required />
                  <Input type="date" name="due_date" />
                  <Input type="time" name="due_time" />
                  <Button type="submit">Adicionar</Button>
                </form>
              ) : null}
            </section>
          </CardContent>
        </Card>
      ) : selectedKnowledgeId ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState title="Item interno nao encontrado." />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

async function CompanyRhSection(props: {
  organizationId: string;
  canEdit: boolean;
  canView: boolean;
  birthdaysMonth?: string;
  absencesMonth?: string;
}) {
  if (!props.canView) return <CompanySettingsRestrictedSection />;

  const supabase = await createServerSupabase();
  const [membersResult, documentsResult, absencesResult, birthdaysResult] = await Promise.all([
    supabase
      .from("team_members")
      .select("*")
      .eq("organization_id", props.organizationId)
      .order("name"),
    supabase
      .from("hr_documents")
      .select("*")
      .eq("organization_id", props.organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("hr_absences")
      .select("*")
      .eq("organization_id", props.organizationId)
      .order("start_date", { ascending: false }),
    supabase
      .from("hr_birthdays")
      .select("*")
      .eq("organization_id", props.organizationId)
      .order("birthday", { ascending: true }),
  ]);
  const members = membersResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const absences = absencesResult.data ?? [];
  const birthdays = birthdaysResult.data ?? [];
  const memberById = new Map(members.map((member) => [member.id, member]));
  const documentLinks = new Map<string, string>();
  await Promise.all(
    documents.map(async (document) => {
      if (!document.storage_path) return;
      const { data } = await supabase.storage
        .from("attachments")
        .createSignedUrl(document.storage_path, 60 * 10);
      if (data?.signedUrl) documentLinks.set(document.id, data.signedUrl);
    }),
  );
  const birthdayMonth = getCalendarMonth(props.birthdaysMonth);
  const absenceMonth = getCalendarMonth(props.absencesMonth);
  const birthdayEvents = [
    ...members
      .filter((member) => member.birth_date)
      .map((member) => ({
        date: monthDayInYear(member.birth_date!, birthdayMonth.year),
        title: member.name,
        detail: "Colaborador",
        href: `/minha-empresa?tab=rh`,
      })),
    ...birthdays.map((birthday) => ({
      date: monthDayInYear(birthday.birthday, birthdayMonth.year),
      title: birthday.name,
      detail: birthday.notes ?? "Aniversario manual",
    })),
  ];
  const absenceEvents = absences.flatMap((absence) => {
    const member = memberById.get(absence.team_member_id);
    return enumerateDateRange(absence.start_date, absence.end_date ?? absence.start_date).map((date) => ({
      date,
      title: `${absenceLabel(absence.absence_type)}: ${member?.name ?? "Colaborador"}`,
      detail: absence.notes ?? "",
    }));
  });

  return (
    <div className="space-y-6">
      <CompanyTeamSection {...props} title="RH > Colaboradores" />
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Contratos e documentos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Documentos de RH vinculados aos colaboradores da empresa.
            </p>
          </div>
          {props.canEdit ? (
            <ModalDisclosure
              title="Anexar documento de RH"
              description="Envie contratos e documentos vinculados aos colaboradores."
              trigger={<Button type="button">+ Anexar documento</Button>}
            >
              <form action={createHrDocumentWithUploadAction} className="grid gap-3">
                <Input name="title" placeholder="Nome do documento" required />
                <select name="team_member_id" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Sem colaborador vinculado</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
                <Input name="document_type" placeholder="Tipo do documento" required />
                <div className="grid gap-3 md:grid-cols-2">
                  <Input type="date" name="document_date" />
                  <Input type="date" name="due_date" />
                </div>
                <select name="status" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="active">Ativo</option>
                  <option value="pending">Pendente</option>
                  <option value="expired">Vencido</option>
                  <option value="archived">Arquivado</option>
                </select>
                <Input type="file" name="file" required />
                <Button type="submit">Anexar documento</Button>
              </form>
            </ModalDisclosure>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {documents.length ? (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Documento</th>
                    <th className="px-4 py-3 font-medium">Colaborador</th>
                    <th className="px-4 py-3 font-medium">Datas</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => {
                    const url = documentLinks.get(document.id);
                    return (
                      <tr key={document.id} className="border-t bg-card align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium">{document.title}</p>
                          <p className="text-xs text-muted-foreground">{document.document_type}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {document.team_member_id ? memberById.get(document.team_member_id)?.name ?? "-" : "-"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <p>Data: {formatDate(document.document_date)}</p>
                          <p>Venc.: {formatDate(document.due_date)}</p>
                        </td>
                        <td className="px-4 py-3"><Badge variant="outline">{document.status}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {url ? (
                              <>
                                <Button asChild size="sm" variant="outline">
                                  <a href={url} target="_blank" rel="noreferrer">Visualizar</a>
                                </Button>
                                <Button asChild size="sm" variant="outline">
                                  <a href={url} download={document.file_name ?? document.title}>Baixar</a>
                                </Button>
                              </>
                            ) : null}
                            {props.canEdit ? (
                              <>
                                <details className="relative">
                                  <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary">
                                    Editar
                                  </summary>
                                  <div className="absolute right-0 z-20 mt-2 w-[min(520px,calc(100vw-2rem))] rounded-lg border bg-card p-4 text-left shadow-xl">
                                    <form
                                      action={async (formData) => {
                                        "use server";
                                        await updateHrDocumentAction(document.id, formData);
                                      }}
                                      className="grid gap-3 md:grid-cols-2"
                                    >
                                      <input type="hidden" name="storage_path" value={document.storage_path ?? ""} />
                                      <input type="hidden" name="file_name" value={document.file_name ?? ""} />
                                      <input type="hidden" name="mime_type" value={document.mime_type ?? ""} />
                                      <input type="hidden" name="size_bytes" value={document.size_bytes ?? ""} />
                                      <Input name="title" defaultValue={document.title} required />
                                      <Input name="document_type" defaultValue={document.document_type} required />
                                      <select
                                        name="team_member_id"
                                        defaultValue={document.team_member_id ?? ""}
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                      >
                                        <option value="">Sem colaborador</option>
                                        {members.map((member) => (
                                          <option key={member.id} value={member.id}>{member.name}</option>
                                        ))}
                                      </select>
                                      <select
                                        name="status"
                                        defaultValue={document.status}
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                      >
                                        <option value="active">Ativo</option>
                                        <option value="pending">Pendente</option>
                                        <option value="expired">Vencido</option>
                                        <option value="archived">Arquivado</option>
                                      </select>
                                      <Input type="date" name="document_date" defaultValue={document.document_date ?? ""} />
                                      <Input type="date" name="due_date" defaultValue={document.due_date ?? ""} />
                                      <Button type="submit" size="sm" className="md:col-span-2">Salvar documento</Button>
                                    </form>
                                  </div>
                                </details>
                                <DeleteButton
                                  label="Apagar"
                                  confirmMessage="Apagar este documento de RH?"
                                  action={async () => {
                                    "use server";
                                    await deleteHrDocumentAction(document.id);
                                  }}
                                />
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Nenhum documento de RH cadastrado." />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ferias e faltas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Registros com data ficam visiveis no mapa mensal do RH.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {props.canEdit ? (
            <form action={createHrAbsenceAction} className="grid gap-3 rounded-md border bg-background p-4 md:grid-cols-5">
              <select name="team_member_id" className="h-10 rounded-md border border-input bg-background px-3 text-sm" required>
                <option value="">Colaborador</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
              <select name="absence_type" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="ferias">Ferias</option>
                <option value="falta">Falta</option>
                <option value="afastamento">Afastamento</option>
                <option value="outro">Outro</option>
              </select>
              <Input type="date" name="start_date" required />
              <Input type="date" name="end_date" />
              <Input name="notes" placeholder="Observacao" />
              <Button type="submit" className="md:col-span-5">Adicionar registro</Button>
            </form>
          ) : null}
          <CalendarNav month={absenceMonth} paramName="absencesMonth" />
          <MiniCalendar month={absenceMonth} events={absenceEvents} />
          {absences.length ? (
            <div className="space-y-2">
              {absences.slice(0, 8).map((absence) => (
                <div key={absence.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
                  <div>
                    <p className="font-medium">{absenceLabel(absence.absence_type)} - {memberById.get(absence.team_member_id)?.name ?? "Colaborador"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(absence.start_date)} ate {formatDate(absence.end_date ?? absence.start_date)}
                    </p>
                  </div>
                  {props.canEdit ? (
                    <DeleteButton
                      label="Apagar"
                      confirmMessage="Apagar este registro?"
                      action={async () => {
                        "use server";
                        await deleteHrAbsenceAction(absence.id);
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Aniversarios</CardTitle>
          <p className="text-sm text-muted-foreground">
            Datas vindas dos colaboradores e aniversarios manuais da empresa.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {props.canEdit ? (
            <form action={createHrBirthdayAction} className="grid gap-3 rounded-md border bg-background p-4 md:grid-cols-4">
              <select name="team_member_id" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Aniversario manual</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
              <Input name="name" placeholder="Nome" required />
              <Input type="date" name="birthday" required />
              <Input name="notes" placeholder="Observacao" />
              <Button type="submit" className="md:col-span-4">Adicionar aniversario</Button>
            </form>
          ) : null}
          <CalendarNav month={birthdayMonth} paramName="birthdaysMonth" />
          <MiniCalendar month={birthdayMonth} events={birthdayEvents} />
          {birthdays.length ? (
            <div className="space-y-2">
              {birthdays.map((birthday) => (
                <div key={birthday.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
                  <div>
                    <p className="font-medium">{birthday.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(birthday.birthday)}</p>
                  </div>
                  {props.canEdit ? (
                    <DeleteButton
                      label="Apagar"
                      confirmMessage="Apagar este aniversario manual?"
                      action={async () => {
                        "use server";
                        await deleteHrBirthdayAction(birthday.id);
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

async function CompanyTeamSection({
  organizationId,
  canEdit,
  canView,
  title = "Equipe",
}: {
  organizationId: string;
  canEdit: boolean;
  canView: boolean;
  title?: string;
}) {
  if (!canView) return <CompanySettingsRestrictedSection />;

  const supabase = await createServerSupabase();
  const [membersResult, recurringResult] = await Promise.all([
    supabase
      .from("team_members")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("recurring_expenses")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "active"),
  ]);
  const members = membersResult.data ?? [];
  const recurringByMember = new Map(
    (recurringResult.data ?? []).map((item) => [item.team_member_id, item]),
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Membros operacionais vinculados a esta empresa.
          </p>
        </div>
        <TeamMemberModal canEdit={canEdit} />
      </CardHeader>
      <CardContent>
        {!canEdit ? (
          <p className="mb-4 rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
            Apenas o proprietario da empresa pode editar estas informacoes.
          </p>
        ) : null}

        {members.length ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Membro</th>
                  <th className="px-4 py-3 font-medium">Funcao</th>
                  <th className="px-4 py-3 font-medium">Nascimento</th>
                  <th className="px-4 py-3 font-medium">Documento/PIX</th>
                  <th className="px-4 py-3 font-medium">Valor mensal</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const recurring = recurringByMember.get(member.id);
                  return (
                    <tr key={member.id} className="border-t bg-card align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email ?? "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {member.role_title ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(member.birth_date)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <p>{member.document_number ?? "-"}</p>
                        <p className="text-xs">{member.pix_key ? `PIX: ${member.pix_key}` : "PIX nao informado"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{formatCurrency(member.monthly_amount ?? 0)}</p>
                        {recurring ? (
                          <p className="text-xs text-muted-foreground">Despesa mensal preparada</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={member.status === "active" ? "secondary" : "outline"}>
                          {member.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <div className="flex justify-end gap-2">
                            <TeamMemberModal canEdit={canEdit} member={member} triggerLabel="Editar" />
                            <DeleteButton
                              label="Apagar"
                              confirmMessage="Apagar este membro? Despesas mensais pendentes vinculadas tambem serao removidas."
                              action={async () => {
                                "use server";
                                await deleteTeamMemberAction(member.id);
                              }}
                            />
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-muted-foreground">Somente leitura</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nenhum membro cadastrado." />
        )}
      </CardContent>
    </Card>
  );
}

async function CompanyFinancialSection({
  organizationId,
  canEdit,
  canView,
}: {
  organizationId: string;
  canEdit: boolean;
  canView: boolean;
}) {
  if (!canView) return <CompanySettingsRestrictedSection />;

  const supabase = await createServerSupabase();
  const { data: settings } = await supabase
    .from("company_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("singleton_key", "default")
    .maybeSingle();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variaveis financeiras</CardTitle>
        <p className="text-sm text-muted-foreground">
          Dados bancarios e instrucoes de recebimento da empresa.
        </p>
      </CardHeader>
      <CardContent>
        <CompanyBankForm settings={settings} canEdit={canEdit} />
      </CardContent>
    </Card>
  );
}

async function CompanyClientsSection({
  q,
  organizationId,
}: {
  q: string;
  organizationId: string;
}) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  const clients = data ?? [];
  const normalized = q.trim().toLowerCase();
  const filtered = normalized
    ? clients.filter((client) =>
        [client.name, client.document, client.email, client.phone]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized)),
      )
    : clients;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Base de clientes</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Mesma base usada em Servicos, Propostas e Financeiro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClientCreateModal />
          <Link className="text-sm font-medium text-primary hover:underline" href="/clientes">
            Abrir modulo completo
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <form className="mb-4 flex gap-2">
          <input type="hidden" name="tab" value="clientes" />
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nome, CPF/CNPJ, e-mail ou telefone"
              className="pl-9"
            />
          </div>
        </form>

        {filtered.length ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id} className="border-t bg-card">
                    <td className="px-4 py-3">
                      <Link className="font-medium hover:underline" href={`/clientes/${client.id}`}>
                        {client.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{client.document}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <p>{client.email ?? "-"}</p>
                      <p>{client.phone ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{client.kind === "pf" ? "PF" : "PJ"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nenhum cliente encontrado." />
        )}
      </CardContent>
    </Card>
  );
}

async function CompanyServicesSection({
  organizationId,
  canEdit,
  canView,
}: {
  organizationId: string;
  canEdit: boolean;
  canView: boolean;
}) {
  if (!canView) return <CompanySettingsRestrictedSection />;

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("company_services")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  const services = data ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card>
        <CardHeader>
          <CardTitle>Servicos e nichos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length ? (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Servico</th>
                    <th className="px-4 py-3 font-medium">Preco</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id} className="border-t bg-card align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">{service.name}</p>
                        <p className="text-xs text-muted-foreground">{service.niche}</p>
                        {service.description ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {service.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <p>{formatCurrency(service.base_price)}</p>
                        <p className="text-xs">{service.billing_unit ?? "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={service.is_active ? "secondary" : "outline"}>
                          {service.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Nenhum servico cadastrado." />
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Novo servico</CardTitle>
          </CardHeader>
          <CardContent>
            <CompanyServiceForm />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Regras da empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
              Apenas o proprietario da empresa pode editar estas informacoes.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompanySettingsRestrictedSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Minha Empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
          Apenas proprietario e administradores operacionais ativos podem visualizar estas informacoes.
        </p>
      </CardContent>
    </Card>
  );
}

type CalendarMonth = {
  date: Date;
  year: number;
  month: number;
  key: string;
  label: string;
};

type MiniCalendarEvent = {
  date: string;
  title: string;
  detail?: string | null;
  href?: string;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function getCalendarMonth(value: string | undefined): CalendarMonth {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) - 1 : now.getMonth();
  const date = new Date(Date.UTC(year, month, 1));
  return {
    date,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date),
  };
}

function shiftMonth(month: CalendarMonth, amount: number) {
  const date = new Date(Date.UTC(month.year, month.month + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function CalendarNav({ month, paramName }: { month: CalendarMonth; paramName: string }) {
  const makeHref = (value: string) => `/minha-empresa?tab=rh&${paramName}=${value}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold capitalize">
        <CalendarDays className="size-4 text-primary" aria-hidden="true" />
        {month.label}
      </div>
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={makeHref(shiftMonth(month, -1))}>Mes anterior</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={makeHref(getCalendarMonth(undefined).key)}>Mes atual</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={makeHref(shiftMonth(month, 1))}>Proximo mes</Link>
        </Button>
      </div>
    </div>
  );
}

function MiniCalendar({ month, events }: { month: CalendarMonth; events: MiniCalendarEvent[] }) {
  const days = buildCalendarDays(month);
  const eventsByDate = new Map<string, MiniCalendarEvent[]>();
  events.forEach((event) => {
    if (!event.date.startsWith(month.key)) return;
    const current = eventsByDate.get(event.date) ?? [];
    current.push(event);
    eventsByDate.set(event.date, current);
  });
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 bg-secondary text-center text-xs font-medium text-muted-foreground">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
          <div key={day} className="px-2 py-2">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsByDate.get(day.key) ?? [];
          return (
            <div
              key={day.key}
              className={cn(
                "min-h-24 border-r border-t p-2 text-xs last:border-r-0",
                day.outside && "bg-secondary/30 text-muted-foreground",
              )}
            >
              <p className="mb-1 font-medium">{day.day}</p>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event, index) => {
                  const content = (
                    <span className="block rounded bg-primary/10 px-2 py-1 text-left text-primary">
                      <span className="block truncate font-medium">{event.title}</span>
                      {event.detail ? <span className="block truncate opacity-80">{event.detail}</span> : null}
                    </span>
                  );
                  return event.href ? (
                    <Link key={`${event.title}-${index}`} href={event.href}>{content}</Link>
                  ) : (
                    <span key={`${event.title}-${index}`}>{content}</span>
                  );
                })}
                {dayEvents.length > 3 ? (
                  <span className="block text-muted-foreground">+{dayEvents.length - 3} item(ns)</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildCalendarDays(month: CalendarMonth) {
  const firstDay = new Date(Date.UTC(month.year, month.month, 1));
  const startOffset = firstDay.getUTCDay();
  const start = new Date(Date.UTC(month.year, month.month, 1 - startOffset));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      day: date.getUTCDate(),
      outside: date.getUTCMonth() !== month.month,
    };
  });
}

function monthDayInYear(dateValue: string, year: number) {
  const [, month, day] = dateValue.slice(0, 10).split("-");
  return `${year}-${month}-${day}`;
}

function enumerateDateRange(startValue: string, endValue: string) {
  const dates: string[] = [];
  const start = new Date(`${startValue}T00:00:00.000Z`);
  const end = new Date(`${endValue}T00:00:00.000Z`);
  for (let cursor = start, count = 0; cursor <= end && count < 62; count += 1) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function absenceLabel(value: string) {
  const labels: Record<string, string> = {
    ferias: "Ferias",
    falta: "Falta",
    afastamento: "Afastamento",
    outro: "Outro",
  };
  return labels[value] ?? value;
}

function ComingSoonSection({ label }: { label: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState title="Secao em breve. Ainda nao ha funcionalidade ativa nesta fase." />
      </CardContent>
    </Card>
  );
}
