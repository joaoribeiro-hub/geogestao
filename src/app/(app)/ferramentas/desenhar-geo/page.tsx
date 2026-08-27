import Link from "next/link";
import { AlertTriangle, DraftingCompass, FileDown, Grid3X3, Ruler } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DesenharGeoWorkspace } from "@/components/tools/desenhar-geo/desenhar-geo-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DesenharGeoToolPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Desenhar GEO"
        description="Gerador de perímetro por azimute, rumo ou deflexão, com cálculo local e exportação DXF inicial."
      />

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Beta funcional</Badge>
            <Badge variant="outline">Topografia</Badge>
            <Badge variant="outline">DXF local</Badge>
          </div>
          <CardTitle className="text-2xl">Reconstrua o perímetro sem confundir direção com georreferenciamento.</CardTitle>
          <CardDescription>
            Azimute, rumo e deflexão desenham a forma. Para KML, a ferramenta exigirá coordenada inicial e CRS real.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/ferramentas">Voltar para ferramentas</Link>
          </Button>
        </CardContent>
      </Card>

      <DesenharGeoWorkspace />

      <Card>
        <CardHeader>
          <CardTitle>Regras técnicas preservadas</CardTitle>
          <CardDescription>Guardrails desta fase e das próximas exportações.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Rule icon={DraftingCompass} text="Rumo e deflexão são normalizados internamente para azimute decimal." />
          <Rule icon={Ruler} text="O fechamento é exibido como ΔE, ΔN, erro linear e perímetro total." />
          <Rule icon={Grid3X3} text="DXF funciona em coordenadas locais/projetadas sem depender de mapa geográfico." />
          <Rule icon={AlertTriangle} text="KML segue bloqueado até existir georreferenciamento real. Nada de 0,0 falso." />
          <Rule icon={FileDown} text="DWG fica para fase futura com conversor externo configurado; não renomeamos DXF como DWG." />
        </CardContent>
      </Card>
    </div>
  );
}

function Rule({ icon: Icon, text }: { icon: typeof DraftingCompass; text: string }) {
  return (
    <div className="flex gap-3 rounded-md bg-secondary p-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
