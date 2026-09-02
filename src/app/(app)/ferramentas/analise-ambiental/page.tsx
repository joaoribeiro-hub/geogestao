import Link from "next/link";
import { Database, Layers3, Leaf, ServerCog, Waves } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  EnvironmentalAnalysisUploader,
  type EnvironmentalJob,
} from "@/components/tools/analise-ambiental/environmental-analysis-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import { asUntypedSupabase } from "@/lib/supabase/untyped";
import { getEnvironmentalWorkerHealth } from "@/lib/tools/analise-ambiental/worker";

const states = [
  "aguardando",
  "lendo_area",
  "limite_extraido",
  "resolvendo_providers",
  "provider_pendente",
  "processando_vegetacao",
  "processando_agua",
  "processando_drenagem",
  "processando_hidrografia",
  "gerando_outputs",
  "concluido",
  "worker_pendente",
  "erro",
];

export default async function AnaliseAmbientalToolPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  const organization = context.organization;
  const untypedSupabase = asUntypedSupabase(supabase);
  const { data: jobs } = organization
    ? await untypedSupabase
        .from("module_environmental_analysis_jobs")
        .select(
          "id,status,original_filename,created_at,input_size_bytes,requested_layers,requested_sources,source_options,current_image_source,current_image_storage_path,area_ha,bbox,result_summary,fusion_summary,training_summary,warnings,output_storage_paths,error_message,finished_at,progress",
        )
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };
  const workerHealth = await getEnvironmentalWorkerHealth();
  const hidroProvider = workerHealth.providers?.hidrografia_oficial;
  const carProvider = workerHealth.providers?.car;
  const currentImageProvider = workerHealth.providers?.current_image;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Análise Ambiental"
        description="Upload de KML/KMZ, criação de job ambiental e histórico por organização."
      />

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Beta operacional</Badge>
            <Badge variant="outline">Ambiental</Badge>
            <Badge variant="outline">worker Python</Badge>
            <Badge variant="outline">Storage privado</Badge>
          </div>
          <CardTitle className="text-2xl">KML como área de interesse; processamento pesado fora do navegador.</CardTitle>
          <CardDescription>
            O app cria jobs, salva arquivos e consulta resultados. Vegetação, água, drenagem, vetorização e exportações finais rodam no worker separado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/ferramentas">Voltar para ferramentas</Link>
          </Button>
        </CardContent>
      </Card>

      <EnvironmentalAnalysisUploader
        initialJobs={(jobs ?? []) as EnvironmentalJob[]}
        hidroProvider={{
          configured: Boolean(hidroProvider?.configured),
          source: hidroProvider?.source ?? "ANA/SNIRH BHO 6",
          version: hidroProvider?.version ?? "6.2.4",
        }}
        sourceProviders={{
          carConfigured: Boolean(carProvider?.configured),
          currentImageConfigured: Boolean(currentImageProvider?.configured),
          dynamicWorldConfigured: Boolean(currentImageProvider?.dynamic_world),
        }}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Camadas previstas</CardTitle>
            <CardDescription>Fontes e métodos ficarão registrados por camada, com nível de confiança.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <LayerCard icon={Layers3} title="Limite da propriedade" text="KML/KMZ validado, AOI em EPSG:4326 e CRS métrico estimado para cálculo." />
            <LayerCard icon={Leaf} title="Vegetação" text="MapBiomas local/COG ou GEE opcional como provider, com vetorização no worker." />
            <LayerCard icon={Waves} title="Água e drenagem" text="MapBiomas Água, hidrografia ANA/BHO e drenagem provável por DEM." />
            <LayerCard icon={Database} title="Exportações" text="KML/KMZ, SHP.zip, GeoJSON, relatório e GeoTIFF recortado quando disponível." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contrato do worker</CardTitle>
            <CardDescription>Estados aceitos para API, banco e worker.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 rounded-md bg-secondary p-3 text-sm">
              <ServerCog className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>O worker consome jobs `worker_pendente`, atualiza status/progresso e grava outputs no bucket `documentos`.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {states.map((state) => (
                <Badge key={state} variant="outline">
                  {state}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LayerCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Layers3;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <Icon className="mb-3 size-5 text-primary" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
