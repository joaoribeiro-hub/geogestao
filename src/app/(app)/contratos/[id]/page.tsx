import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { updateContractDraftAction } from "@/app/(app)/contratos/actions";
import { PrintDocumentButton } from "@/components/documents/document-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ContractStatus, Json } from "@/types/database";

const statusLabels: Record<ContractStatus, string> = {
  contrato_a_gerar: "Contrato a gerar",
  contrato_gerado: "Contrato gerado",
  enviado_para_assinatura: "Enviado para assinatura",
  assinado: "Assinado",
  em_execucao: "Em execucao",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: contract } = await supabase.from("contracts").select("*").eq("id", id).single();
  if (!contract) notFound();

  const [
    { data: client },
    { data: proposal },
    { data: serviceCard },
    attachmentsResult,
    proposalAttachmentsResult,
    { data: company },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", contract.client_id).single(),
    contract.proposal_id
      ? supabase.from("proposals").select("*").eq("id", contract.proposal_id).maybeSingle()
      : Promise.resolve({ data: null }),
    contract.service_card_id
      ? supabase.from("service_cards").select("*").eq("id", contract.service_card_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", "contract")
      .eq("entity_id", contract.id)
      .order("created_at", { ascending: false }),
    contract.proposal_id
      ? supabase
          .from("attachments")
          .select("*")
          .eq("entity_type", "proposal")
          .eq("entity_id", contract.proposal_id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("company_settings").select("*").eq("singleton_key", "main").maybeSingle(),
  ]);

  const contractPdf = (attachmentsResult.data ?? []).find(
    (attachment) =>
      attachment.mime_type === "application/pdf" || attachment.file_path.endsWith(".pdf"),
  );
  const proposalPdf = (proposalAttachmentsResult.data ?? []).find(
    (attachment) =>
      attachment.mime_type === "application/pdf" || attachment.file_path.endsWith(".pdf"),
  );
  const contractPdfUrl = contractPdf
    ? (
        await supabase.storage
          .from("attachments")
          .createSignedUrl(contractPdf.file_path, 60 * 60)
      ).data?.signedUrl ?? null
    : null;
  const proposalPdfUrl = proposalPdf
    ? (
        await supabase.storage
          .from("attachments")
          .createSignedUrl(proposalPdf.file_path, 60 * 60)
      ).data?.signedUrl ?? null
    : null;

  const clauses = asStringArray(contract.clauses_json);
  const signers = asRecordArray(contract.signers_json);
  const modelData = asRecord(contract.model_data);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <PageHeader
          title={contract.title}
          description="Detalhe, continuidade do contrato e preview A4 do documento."
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/contratos">Voltar</Link>
          </Button>
          <PrintDocumentButton label="Gerar PDF do contrato" />
          {contractPdfUrl ? (
            <Button asChild>
              <a href={contractPdfUrl} target="_blank" rel="noreferrer">
                <Download aria-hidden="true" />
                Baixar contrato PDF
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo do contrato</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <Info label="Cliente" value={client?.name ?? "-"} />
              <Info label="Status" value={statusLabels[contract.status]} />
              <Info label="Valor" value={formatCurrency(contract.amount)} />
              <Info label="Pagamento" value={contract.payment_status === "pagamento_efetuado" ? "Pago" : "Nao pago"} />
              <Info label="Inicio" value={formatDate(contract.starts_at)} />
              <Info label="Fim" value={formatDate(contract.ends_at)} />
              <Info label="Proposta" value={proposal?.title ?? "Sem proposta"} />
              <Info label="Servico" value={serviceCard?.title ?? "Sem servico"} />
            </CardContent>
          </Card>

          <section className="mx-auto w-full max-w-[860px] rounded-md border bg-muted p-4 print:border-0 print:bg-white print:p-0">
            <article className="min-h-[1120px] bg-white p-10 text-slate-900 shadow-sm print:min-h-0 print:shadow-none">
              <div className="border-b pb-8">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Contrato de Prestacao de Servicos
                </p>
                <h1 className="mt-4 text-3xl font-bold">{contract.title}</h1>
                <p className="mt-3 text-sm text-slate-600">
                  {company?.trade_name ?? company?.legal_name ?? "GeoGestao"}
                </p>
              </div>

              <DocumentBlock title="Partes">
                <p>Contratante: {client?.name ?? "-"}</p>
                <p>Contratada: {company?.legal_name ?? company?.trade_name ?? "GeoGestao"}</p>
              </DocumentBlock>

              <DocumentBlock title="Objeto e servicos">
                <p>{contract.description ?? proposal?.description ?? "Prestacao de servicos tecnicos conforme proposta vinculada."}</p>
                <p>{serviceCard?.title ?? proposal?.title ?? ""}</p>
              </DocumentBlock>

              <DocumentBlock title="Prazos">
                <p>Inicio: {formatDate(contract.starts_at)}</p>
                <p>Fim: {formatDate(contract.ends_at)}</p>
              </DocumentBlock>

              <DocumentBlock title="Honorarios e pagamento">
                <p>Valor total: {formatCurrency(contract.amount)}</p>
                <p>{getNestedString(modelData, "finance", "payment_terms") ?? "Condicoes de pagamento conforme negociacao entre as partes."}</p>
              </DocumentBlock>

              <DocumentBlock title="Clausulas">
                {clauses.length ? (
                  <ol className="list-decimal space-y-2 pl-5">
                    {clauses.map((clause) => (
                      <li key={clause}>{clause}</li>
                    ))}
                  </ol>
                ) : (
                  <p>Clausulas ainda nao preenchidas.</p>
                )}
              </DocumentBlock>

              <DocumentBlock title="Foro">
                <p>{contract.forum ?? "Foro ainda nao definido."}</p>
              </DocumentBlock>

              <DocumentBlock title="Assinaturas">
                <div className="grid gap-6 md:grid-cols-2">
                  {signers.length ? (
                    signers.map((signer) => (
                      <div key={`${signer.role}-${signer.name}`} className="border-t pt-4">
                        <p className="font-medium">{signer.name ?? signer.role}</p>
                        <p>{signer.document ?? ""}</p>
                        <p>{signer.email ?? ""}</p>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="border-t pt-4">Contratante</div>
                      <div className="border-t pt-4">Contratada</div>
                    </>
                  )}
                </div>
              </DocumentBlock>
            </article>
          </section>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Atalhos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {contractPdfUrl ? (
                <Button asChild variant="outline">
                  <a href={contractPdfUrl} target="_blank" rel="noreferrer">
                    <Download aria-hidden="true" />
                    Baixar contrato PDF
                  </a>
                </Button>
              ) : (
                <p className="rounded-md border p-3 text-sm text-muted-foreground">
                  Documento ainda nao gerado. Use o preview A4 para imprimir/salvar como PDF.
                </p>
              )}
              {proposalPdfUrl ? (
                <Button asChild variant="outline">
                  <a href={proposalPdfUrl} target="_blank" rel="noreferrer">
                    <Download aria-hidden="true" />
                    Baixar proposta PDF
                  </a>
                </Button>
              ) : null}
              {proposal ? (
                <Button asChild variant="outline">
                  <Link href={`/propostas/${proposal.id}`}>
                    <ExternalLink aria-hidden="true" />
                    Abrir proposta
                  </Link>
                </Button>
              ) : null}
              {serviceCard ? (
                <Button asChild variant="outline">
                  <Link href={`/servicos/${serviceCard.id}`}>
                    <ExternalLink aria-hidden="true" />
                    Abrir servico
                  </Link>
                </Button>
              ) : null}
              {client ? (
                <Button asChild variant="outline">
                  <Link href={`/clientes/${client.id}`}>
                    <ExternalLink aria-hidden="true" />
                    Abrir cliente
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <ContractWizard
            action={updateContractDraftAction.bind(null, contract.id)}
            contract={contract}
            clientName={client?.name ?? ""}
            proposalTitle={proposal?.title ?? ""}
            clauses={clauses}
            signers={signers}
            modelData={modelData}
          />
        </aside>
      </div>
    </div>
  );
}

function ContractWizard({
  action,
  contract,
  clientName,
  proposalTitle,
  clauses,
  signers,
  modelData,
}: {
  action: (formData: FormData) => Promise<void>;
  contract: {
    title: string;
    description: string | null;
    starts_at: string | null;
    ends_at: string | null;
    forum: string | null;
  };
  clientName: string;
  proposalTitle: string;
  clauses: string[];
  signers: Array<Record<string, string | null>>;
  modelData: Record<string, Json>;
}) {
  const signer = (role: string) => signers.find((item) => item.role === role) ?? {};

  return (
    <Card id="wizard">
      <CardHeader>
        <CardTitle>Continuar contrato</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-5">
          <WizardStep number="1" title="Registro">
            <Field label="Titulo">
              <Input name="title" defaultValue={contract.title} />
            </Field>
            <Field label="Contratante">
              <Input name="contractor_notes" defaultValue={clientName} />
            </Field>
          </WizardStep>

          <WizardStep number="2" title="Demanda">
            <Field label="Proposta vinculada">
              <Input name="proposal_title" defaultValue={proposalTitle} readOnly />
            </Field>
            <Field label="Objeto">
              <Textarea name="object" defaultValue={contract.description ?? ""} />
            </Field>
            <Field label="Servicos">
              <Textarea name="services" defaultValue={getNestedString(modelData, "demand", "services") ?? ""} />
            </Field>
          </WizardStep>

          <WizardStep number="3" title="Prazos">
            <Field label="Prazo de execucao">
              <Input name="execution_deadline" defaultValue={getNestedString(modelData, "deadlines", "execution_deadline") ?? ""} />
            </Field>
            <Field label="Inicio">
              <Input name="starts_at" type="date" defaultValue={contract.starts_at ?? ""} />
            </Field>
            <Field label="Fim">
              <Input name="ends_at" type="date" defaultValue={contract.ends_at ?? ""} />
            </Field>
          </WizardStep>

          <WizardStep number="4" title="Financeiro">
            <Field label="Condicoes de pagamento">
              <Textarea name="payment_terms" defaultValue={getNestedString(modelData, "finance", "payment_terms") ?? ""} />
            </Field>
            <Field label="Formas de pagamento">
              <Textarea
                name="payment_methods"
                defaultValue={asStringArray(asRecord(modelData.finance).payment_methods).join("\n")}
                placeholder="Pix&#10;Transferencia bancaria&#10;Boleto"
              />
            </Field>
          </WizardStep>

          <WizardStep number="5" title="Clausulas">
            <Field label="Clausulas, uma por linha">
              <Textarea name="clauses" defaultValue={clauses.join("\n")} rows={6} />
            </Field>
            <Field label="Foro">
              <Input name="forum" defaultValue={contract.forum ?? ""} />
            </Field>
          </WizardStep>

          <WizardStep number="6" title="Assinaturas">
            <SignerFields prefix="signer_client" title="Contratante" signer={signer("contratante")} />
            <SignerFields prefix="signer_owner" title="Responsavel/representante" signer={signer("responsavel")} />
            <SignerFields prefix="witness_one" title="Primeira testemunha" signer={signer("testemunha_1")} />
            <SignerFields prefix="witness_two" title="Segunda testemunha" signer={signer("testemunha_2")} />
          </WizardStep>

          <WizardStep number="7" title="Modelo">
            <Field label="Aparencia/observacoes do modelo">
              <Textarea name="appearance" defaultValue={getNestedString(modelData, "model", "appearance") ?? ""} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Preview A4 disponivel</Badge>
              <Badge variant="outline">PDF via imprimir/salvar</Badge>
            </div>
          </WizardStep>

          <Button>Salvar contrato</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SignerFields({
  prefix,
  title,
  signer,
}: {
  prefix: string;
  title: string;
  signer: Record<string, string | null>;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <div className="grid gap-3">
        <Input name={`${prefix}_name`} defaultValue={signer.name ?? ""} placeholder="Nome" />
        <Input name={`${prefix}_document`} defaultValue={signer.document ?? ""} placeholder="Documento" />
        <Input name={`${prefix}_email`} defaultValue={signer.email ?? ""} placeholder="E-mail" />
      </div>
    </div>
  );
}

function WizardStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">
        {number}. {title}
      </legend>
      <div className="mt-3 grid gap-3">{children}</div>
    </fieldset>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
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

function asRecord(value: Json | undefined): Record<string, Json> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json>;
  }
  return {};
}

function asStringArray(value: Json | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRecordArray(value: Json | undefined) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, string | null> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function getNestedString(value: Record<string, Json>, key: string, childKey: string) {
  const child = asRecord(value[key]);
  const target = child[childKey];
  return typeof target === "string" && target.trim() ? target : null;
}
