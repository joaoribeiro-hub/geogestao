import { PageHeader } from "@/components/layout/page-header";
import { RtkPppWorkspace } from "@/components/modules/rtk-ppp/rtk-ppp-workspace";

export default function CorretorRtkPppPage() {
  return (
    <div>
      <PageHeader
        title="Corretor RTK/PPP"
        description="Correção linear de pontos rover a partir da diferença entre base levantada e base corrigida PPP/IBGE."
      />
      <RtkPppWorkspace />
    </div>
  );
}
