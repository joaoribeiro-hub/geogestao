import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { PrintDocumentButton } from "@/components/documents/document-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProposalBasicAction } from "@/app/(app)/propostas/actions";
import { proposalServiceTypes } from "@/lib/constants";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Json, ProposalStage } from "@/types/database";

const stageLabels: Record<ProposalStage, string> = {
  todo: "A fazer",
  sent: "Enviada",
  negotiation: "Em negociacao",
  execution: "Em execucao",
  finished: "Finalizada",
  lost: "Perdida",
};

const serviceTypeLabels = new Map(
  proposalServiceTypes.map((serviceType) => [serviceType.id, serviceType.label]),
);

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: proposal } = await supabase.from("proposals").select("*").eq("id", id).single();
  if (!proposal) notFound();

  const [
    { data: client },
    { data: company },
    attachmentsResult,
    { data: contract },
    { data: serviceCard },
    { data: revenue },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", proposal.client_id).single(),
    supabase.from("company_settings").select("*").eq("singleton_key", "main").maybeSingle(),
    supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", "proposal")
      .eq("entity_id", proposal.id)
      .order("created_at", { ascending: false }),
    proposal.contract_id
      ? supabase.from("contracts").select("*").eq("id", proposal.contract_id).maybeSingle()
      : Promise.resolve({ data: null }),
    proposal.service_card_id
      ? supabase.from("service_cards").select("*").eq("id", proposal.service_card_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("revenues")
      .select("*")
      .eq("proposal_id", proposal.id)
      .eq("auto_generated", true)
      .maybeSingle(),
  ]);

  const attachments = attachmentsResult.data ?? [];
  const pdfAttachment = attachments.find(
    (attachment) =>
      attachment.mime_type === "application/pdf" || attachment.file_path.endsWith(".pdf"),
  );
  const pdfUrl = pdfAttachment
    ? (
        await supabase.storage
          .from("attachments")
          .createSignedUrl(pdfAttachment.file_path, 60 * 60)
      ).data?.signedUrl ?? null
    : null;
  const modelData = asRecord(proposal.model_data);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <PageHeader
          title={proposal.title}
          description="Visualizacao, edicao resumida e preview A4 da proposta."
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/propostas">Voltar</Link>
          </Button>
          <PrintDocumentButton label="Gerar PDF da proposta" />
          {pdfUrl ? (
            <Button asChild>
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                <Download aria-hidden="true" />
                Baixar PDF da proposta
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo comercial</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <Info label="Cliente" value={client?.name ?? "-"} />
              <Info label="Status" value={stageLabels[proposal.stage]} />
              <Info label="Tipo de servico" value={serviceTypeLabels.get(proposal.service_type) ?? "-"} />
              <Info label="Valor" value={formatCurrency(proposal.value)} />
              <Info label="Envio" value={formatDate(proposal.sent_at)} />
              <Info label="Validade" value={formatDate(proposal.valid_until)} />
              <Info
                label="Pagamento"
                value={
                  proposal.payment_status === "pagamento_efetuado" ? "Pago" : "Nao pago"
                }
              />
              <Info label="Receita" value={revenue ? `${formatCurrency(revenue.amount)} - ${revenue.status}` : "Sem lancamento"} />
            </CardContent>
          </Card>

          <section className="mx-auto w-full max-w-[860px] rounded-md border bg-muted p-4 print:border-0 print:bg-white print:p-0">
            <article className="min-h-[1120px] bg-white p-10 text-slate-900 shadow-sm print:min-h-0 print:shadow-none">
              <div className="border-b pb-8">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Orcamento
                </p>
                <h1 className="mt-4 text-3xl font-bold">{proposal.title}</h1>
                <p className="mt-3 text-sm text-slate-600">
                  {company?.trade_name ?? company?.legal_name ?? "GeoGestao"}
                </p>
              </div>

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <DocumentBlock title="Cliente">
                  <p>{client?.name ?? "-"}</p>
                  <p>{client?.document ?? ""}</p>
                  <p>{client?.email ?? ""}</p>
                  <p>{client?.phone ?? ""}</p>
                </DocumentBlock>
                <DocumentBlock title="Dados da proposta">
                  <p>Valor: {formatCurrency(proposal.value)}</p>
                  <p>Validade: {formatDate(proposal.valid_until)}</p>
                  <p>Servico: {serviceTypeLabels.get(proposal.service_type) ?? "-"}</p>
                </DocumentBlock>
              </div>

              <DocumentBlock title="Objetivo">
                <p>{proposal.description ?? getString(modelData.objective) ?? "Proposta comercial para prestacao de servicos tecnicos."}</p>
              </DocumentBlock>

              <DocumentBlock title="Servicos a realizar">
                <p>{proposal.comments ?? getString(modelData.sections) ?? "Escopo tecnico conforme demanda registrada."}</p>
              </DocumentBlock>

              <DocumentBlock title="Prazos">
                <p>Prazo/validade: {formatDate(proposal.valid_until)}</p>
                <p>Data de envio: {formatDate(proposal.sent_at)}</p>
              </DocumentBlock>

              <DocumentBlock title="Precos e formas de pagamento">
                <p>Valor total: {formatCurrency(proposal.value)}</p>
                <p>
                  Condicao atual:{" "}
                  {proposal.payment_status === "pagamento_efetuado" ? "Pago" : "Nao pago"}
                </p>
              </DocumentBlock>

              <DocumentBlock title="Observacoes">
                <p>{proposal.comments ?? "Sem observacoes adicionais."}</p>
              </DocumentBlock>
            </article>
          </section>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Documentos vinculados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border p-3 font-medium hover:border-primary"
                >
                  <Download className="size-4" aria-hidden="true" />
                  {pdfAttachment?.file_name ?? "PDF da proposta"}
                </a>
              ) : (
                <p className="rounded-md border p-3 text-muted-foreground">
                  Documento ainda nao gerado. Use o preview A4 para imprimir/salvar como PDF.
                </p>
              )}
              {contract ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/contratos/${contract.id}`}>
                    <ExternalLink aria-hidden="true" />
                    Abrir contrato
                  </Link>
                </Button>
              ) : null}
              {serviceCard ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/servicos/${serviceCard.id}`}>
                    <ExternalLink aria-hidden="true" />
                    Abrir servico
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card id="editar">
            <CardHeader>
              <CardTitle>Editar resumo</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={updateProposalBasicAction.bind(null, proposal.id)}
                className="grid gap-4"
              >
                <input name="client_id" type="hidden" value={proposal.client_id} />
                <Field label="Titulo">
                  <Input name="title" defaultValue={proposal.title} />
                </Field>
                <Field label="Descricao">
                  <Textarea name="description" defaultValue={proposal.description ?? ""} />
                </Field>
                <Field label="Tipo de servico">
                  <select
                    name="service_type"
                    defaultValue={proposal.service_type}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {proposalServiceTypes.map((serviceType) => (
                      <option key={serviceType.id} value={serviceType.id}>
                        {serviceType.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Valor">
                  <Input
                    name="value"
                    type="number"
                    step="0.01"
                    defaultValue={proposal.value ?? ""}
                  />
                </Field>
                <Field label="Envio">
                  <Input name="sent_at" type="date" defaultValue={proposal.sent_at ?? ""} />
                </Field>
                <Field label="Validade">
                  <Input name="valid_until" type="date" defaultValue={proposal.valid_until ?? ""} />
                </Field>
                <Field label="Observacoes">
                  <Textarea name="comments" defaultValue={proposal.comments ?? ""} />
                </Field>
                <Button>Salvar proposta</Button>
              </form>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function DocumentBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 border-b pb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-1 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function asRecord(value: Json): Record<string, Json> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json>;
  }
  return {};
}

function getString(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value : null;
}
