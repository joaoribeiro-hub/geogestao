import Link from "next/link";
import { Eye, FileCheck2, ListChecks, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const capabilities = [
  "Criar link privado por serviço com token seguro não sequencial.",
  "Liberar apenas documentos marcados como visíveis para o cliente.",
  "Mostrar etapa atual, progresso, previsão e linha do tempo pública.",
  "Separar descrição interna de título e resumo visíveis ao cliente.",
  "Preparar PIN opcional, expiração, QR Code e logs de acesso.",
];

const futureTables = [
  "client_portals",
  "client_portal_links",
  "client_portal_stage_publications",
  "client_portal_documents",
  "client_portal_updates",
  "client_portal_access_logs",
];

export default function PortalClienteToolPage() {
  return (
    <div>
      <PageHeader
        title="Portal do Cliente"
        description="Entrada da ferramenta para acompanhamento público e seguro de serviços."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Beta</Badge>
                <Badge variant="outline">Cliente</Badge>
                <Badge variant="outline">Documentos privados</Badge>
              </div>
              <CardTitle className="text-2xl">Acompanhamento limpo para o cliente, sem expor a operação interna.</CardTitle>
              <CardDescription>
                O cliente não entra no GeoGestão. Ele abre uma página pública controlada com progresso, últimas atualizações,
                etapas publicadas e documentos liberados.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/servicos">Abrir serviços</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/ferramentas">Voltar para ferramentas</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Como deve funcionar</CardTitle>
              <CardDescription>Resumo do fluxo planejado para a próxima fase de implementação do portal.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {capabilities.map((item) => (
                <div key={item} className="flex gap-3 rounded-md border bg-background p-3 text-sm">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visão como cliente</CardTitle>
              <CardDescription>Estrutura visual prevista para o link público.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border bg-background p-4">
                <p className="text-xs uppercase text-muted-foreground">Acompanhamento do serviço</p>
                <h3 className="mt-1 text-xl font-semibold">Georreferenciamento Rural</h3>
                <p className="text-sm text-muted-foreground">Fazenda Boa Esperança · Em andamento · 68%</p>
                <div className="mt-3 h-2 rounded-full bg-secondary">
                  <div className="h-2 w-2/3 rounded-full bg-primary" />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <PreviewCard icon={FileCheck2} title="Resumo atual" text="O que foi concluído, o que está em execução e o próximo passo." />
                <PreviewCard icon={ListChecks} title="Linha do tempo" text="Etapas públicas com status e previsão sem descrição interna." />
                <PreviewCard icon={Eye} title="Documentos" text="Arquivos publicados com signed URL temporária." />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Para usar</CardTitle>
              <CardDescription>A integração dentro do detalhe do serviço será criada em fase futura.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Abra um serviço e, futuramente, acesse a aba ou bloco “Portal do Cliente”.</p>
              <p>Esta fase registra a ferramenta, cria a rota inicial e documenta a arquitetura segura.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Segurança prevista</CardTitle>
              <CardDescription>Nada de bucket público ou IDs sequenciais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3 rounded-md bg-secondary p-3 text-sm">
                <LockKeyhole className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>Token longo com hash no banco, revogação e expiração opcional.</span>
              </div>
              <div className="flex gap-3 rounded-md bg-secondary p-3 text-sm">
                <QrCode className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>QR Code e copiar link ficam previstos, sem publicação automática de dados internos.</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estrutura futura</CardTitle>
              <CardDescription>Tabelas previstas; ainda não criadas nesta fase.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {futureTables.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof FileCheck2;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <Icon className="mb-2 size-4 text-primary" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
