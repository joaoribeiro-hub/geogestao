import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";
import { asUntypedSupabase } from "@/lib/supabase/untyped";
import { formatDate } from "@/lib/utils";

type PublicPortalPayload = {
  organization?: { name?: string | null } | null;
  client?: { name?: string | null } | null;
  service?: {
    id?: string;
    title?: string | null;
    description?: string | null;
    dueDate?: string | null;
    progress?: number | null;
    updatedAt?: string | null;
  } | null;
  column?: { name?: string | null; slug?: string | null } | null;
  stages?: Array<{
    title?: string | null;
    isDone?: boolean | null;
    dueDate?: string | null;
    completedAt?: string | null;
  }>;
  updates?: Array<{
    title?: string | null;
    summary?: string | null;
    publishedAt?: string | null;
  }>;
};

export default async function PublicClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = await createServerSupabase();
  const { data, error } = await asUntypedSupabase(supabase).rpc<PublicPortalPayload>("get_public_client_portal", {
    p_token_hash: tokenHash,
  });

  if (error || !data) notFound();

  const portal = data as PublicPortalPayload;
  const service = portal.service;
  if (!service) notFound();
  const progress = Math.max(0, Math.min(100, Math.round(Number(service.progress ?? 0))));
  const stages = portal.stages ?? [];
  const updates = portal.updates ?? [];

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header className="rounded-lg border bg-card p-6 text-center">
          <p className="text-sm font-semibold text-primary">{portal.organization?.name ?? "GeoGestão"}</p>
          <p className="mt-1 text-xs uppercase text-muted-foreground">Acompanhamento do serviço</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">{service.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {portal.client?.name ? `Cliente ${portal.client.name}` : "Portal privado do cliente"}
          </p>
          <div className="mt-4 flex justify-center">
            <Badge>{portal.column?.name ?? "Em andamento"}</Badge>
          </div>
          <div className="mx-auto mt-5 max-w-xl">
            <div className="h-3 rounded-full bg-secondary">
              <div className="h-3 rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-sm font-medium">{progress}% concluído</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Previsão atual: {formatDate(service.dueDate ?? null)} · Última atualização: {formatDate(service.updatedAt ?? null)}
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Resumo atual</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {service.description || "A empresa ainda não publicou um resumo específico para este acompanhamento."}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader>
              <CardTitle>Acompanhamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stages.length ? (
                stages.map((stage, index) => (
                  <div key={`${stage.title}-${index}`} className="flex gap-3 rounded-md border bg-background p-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                      {stage.isDone ? "✓" : index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{stage.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {stage.isDone
                          ? `Concluído em ${formatDate(stage.completedAt ?? null)}`
                          : stage.dueDate
                            ? `Previsão: ${formatDate(stage.dueDate)}`
                            : "Etapa em acompanhamento."}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
                  As etapas públicas ainda não foram publicadas.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimas atualizações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {updates.length ? (
                updates.map((update, index) => (
                  <div key={`${update.title}-${index}`} className="rounded-md border bg-background p-3">
                    <p className="font-medium">{update.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(update.publishedAt ?? null)}</p>
                    {update.summary ? <p className="mt-2 text-sm text-muted-foreground">{update.summary}</p> : null}
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
                  Nenhuma atualização publicada ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
