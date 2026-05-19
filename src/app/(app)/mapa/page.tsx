import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";

export default async function MapPage() {
  return (
    <div className="grid gap-6" data-testid="map-page">
      <PageHeader
        title="Funcionalidade movida"
        titleTestId="map-title"
        description="A busca de CAR Federal agora pertence ao app MeuIMOVEL-CAR."
      />

      <section className="rounded-lg border bg-card p-6">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-lg font-semibold">
            Esta funcionalidade foi movida para o app MeuIMOVEL-CAR.
          </h2>
          <p className="text-sm text-muted-foreground">
            O GeoGestao continua disponivel para clientes, propostas, contratos,
            servicos, financeiro, documentos, legislacao e anexos. As bases e
            dados geograficos existentes no Supabase nao foram alterados.
          </p>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
