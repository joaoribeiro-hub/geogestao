import Link from "next/link";
import { Search } from "lucide-react";
import { ClientForm } from "@/components/forms/client-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
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
    <div>
      <PageHeader
        title="Clientes"
        description="Cadastro PF/PJ, busca rapida e historico de relacionamento."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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

        <Card>
          <CardHeader>
            <CardTitle>Novo cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
