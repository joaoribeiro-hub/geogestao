import { PageHeader } from "@/components/layout/page-header";
import { SophiaInboxPanel } from "@/components/sophia/sophia-inbox-panel";

export default function SophiaInboxPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sophia - Caixa de entrada"
        description="Envie documentos para a Sophia classificar e preparar a organizacao sem expor arquivos fora da empresa."
      />
      <SophiaInboxPanel />
    </div>
  );
}
