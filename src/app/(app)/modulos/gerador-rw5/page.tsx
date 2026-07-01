import { PageHeader } from "@/components/layout/page-header";
import { Rw5Workspace } from "@/components/modules/rw5/rw5-workspace";

export default function GeradorRw5Page() {
  return (
    <div>
      <PageHeader
        title="Gerador RW5"
        description="Converter arquivos topográficos/TXT/PTS/MC/legados em arquivo RW5 dentro do GeoGestao."
      />
      <Rw5Workspace />
    </div>
  );
}
