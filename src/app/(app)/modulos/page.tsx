import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_MODULES, getModuleStatusLabel } from "@/lib/modules/app-modules";

export default function ModulesOverviewPage() {
  return (
    <div>
      <PageHeader
        title="Modulos"
        description="Apps integrados ao GeoGestao usando o mesmo login, a mesma empresa atual e isolamento por organizacao."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {APP_MODULES.map((module) => (
          <Card key={module.key}>
            <CardHeader>
              <CardTitle>{module.name}</CardTitle>
              <CardDescription>{getModuleStatusLabel(module.status)}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{module.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
