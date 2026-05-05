import Link from "next/link";
import { Search } from "lucide-react";
import { CompanyInfoForm } from "@/components/forms/company-info-form";
import { CompanyServiceForm } from "@/components/forms/company-service-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
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

      {activeTab === "informacoes" ? <CompanyInfoSection /> : null}
      {activeTab === "clientes" ? <CompanyClientsSection q={q} /> : null}
      {activeTab === "servicos-nichos" ? <CompanyServicesSection /> : null}
      {activeTab !== "informacoes" &&
      activeTab !== "clientes" &&
      activeTab !== "servicos-nichos" ? (
        <ComingSoonSection label={tabs.find((item) => item.id === activeTab)?.label ?? ""} />
      ) : null}
    </div>
  );
}

async function CompanyInfoSection() {
  const supabase = await createServerSupabase();
  const { data: settings } = await supabase
    .from("company_settings")
    .select("*")
    .eq("singleton_key", "default")
    .maybeSingle();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informacoes da empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <CompanyInfoForm settings={settings} />
      </CardContent>
    </Card>
  );
}

async function CompanyClientsSection({ q }: { q: string }) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("clients")
    .select("*")
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
        <CardTitle>Clientes</CardTitle>
        <Link className="text-sm font-medium text-primary hover:underline" href="/clientes">
          Abrir modulo completo
        </Link>
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

async function CompanyServicesSection() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("company_services")
    .select("*")
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

      <Card>
        <CardHeader>
          <CardTitle>Novo servico</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyServiceForm />
        </CardContent>
      </Card>
    </div>
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
