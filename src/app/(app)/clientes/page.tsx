import Link from "next/link";
import { Search } from "lucide-react";
import { ClientActions } from "@/components/clients/client-actions";
import { ClientCreateModal } from "@/components/clients/client-create-modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationForUser } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const organization = await getCurrentOrganizationForUser(supabase, user.id);
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("organization_id", organization.id)
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
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader
          title="Base de clientes"
          description="Clientes da organizacao atual, compartilhados com Servicos e Minha Empresa."
        />
        <ClientCreateModal />
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Base de clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="mb-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input name="q" defaultValue={q} placeholder="Buscar por nome, CPF/CNPJ, e-mail ou telefone" className="pl-9" />
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
                      <th className="px-4 py-3 text-right font-medium">Acoes</th>
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
                        <td className="px-4 py-3">
                          <ClientActions client={client} />
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

      </div>
    </div>
  );
}
