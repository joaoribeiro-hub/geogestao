import { PageHeader } from "@/components/layout/page-header";
import { BuscaGeoWorkspace } from "@/components/modules/buscageo/buscageo-workspace";

export default function BuscaGeoModulePage() {
  return (
    <div>
      <PageHeader
        title="BuscaGEO"
        description="Upload de poligono, busca CBERS, preview, processamento e historico por organizacao."
      />
      <BuscaGeoWorkspace />
    </div>
  );
}
