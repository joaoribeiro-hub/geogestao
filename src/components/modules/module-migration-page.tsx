import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ModuleMigrationPage({
  title,
  sourcePath,
  stack,
  summary,
  items,
}: {
  title: string;
  sourcePath: string;
  stack: string;
  summary: string;
  items: string[];
}) {
  return (
    <div>
      <PageHeader title={title} description="Modulo integrado ao hub do GeoGestao." />
      <Card>
        <CardHeader>
          <CardTitle>Modulo em migracao</CardTitle>
          <CardDescription>Funcionalidades sendo convertidas para o GeoGestao.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">{summary}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Origem auditada</p>
              <p className="mt-2 break-words text-sm">{sourcePath}</p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Stack</p>
              <p className="mt-2 text-sm">{stack}</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Proximos passos de migracao</p>
            <ul className="grid gap-2 text-sm text-muted-foreground">
              {items.map((item) => (
                <li key={item} className="rounded-md bg-secondary px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
