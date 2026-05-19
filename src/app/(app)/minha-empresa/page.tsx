import Link from "next/link";
import { Search } from "lucide-react";
import { TeamMemberModal } from "@/components/company/team-member-modal";
import { ClientCreateModal } from "@/components/clients/client-create-modal";
import { CompanyBankForm } from "@/components/forms/company-bank-form";
import { CompanyInfoForm } from "@/components/forms/company-info-form";
import { CompanyServiceForm } from "@/components/forms/company-service-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth";
import {
  canManageOrganization,
  canViewOrganizationSettings,
  getCurrentOrganizationForUser,
  getCurrentProfile,
  getOrganizationMembershipForUser,
} from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn, formatCurrency } from "@/lib/utils";

const tabs = [
  { id: "informacoes", label: "Informacoes" },
  { id: "equipe", label: "Equipe" },
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
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab = "informacoes", q = "" } = await searchParams;
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

      {activeTab === "informacoes" ? (
        <CompanyInfoSection
          organizationId={organization.id}
          canEdit={canEditCompany}
          canView={canViewCompanySettings}
        />
      ) : null}
      {activeTab === "equipe" ? (
        <CompanyTeamSection
          organizationId={organization.id}
          canEdit={canEditCompany}
          canView={canViewCompanySettings}
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
      activeTab !== "equipe" &&
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
        <CardTitle>Informacoes da empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <CompanyInfoForm settings={settings} canEdit={canEdit} />
      </CardContent>
    </Card>
  );
}

async function CompanyTeamSection({
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
          <CardTitle>Equipe</CardTitle>
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
                  <th className="px-4 py-3 font-medium">Valor mensal</th>
                  <th className="px-4 py-3 font-medium">Status</th>
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
