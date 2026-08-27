"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Blocks,
  Crosshair,
  DraftingCompass,
  FileOutput,
  Leaf,
  Map,
  PanelTop,
  Search,
  Satellite,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getToolPricingLabel,
  getToolStatusLabel,
  type GeoGestaoTool,
} from "@/lib/tools/tool-access";
import { operationalProfileLabels, type OperationalProfile } from "@/lib/operational-profile";

const icons = {
  Blocks,
  Crosshair,
  DraftingCompass,
  FileOutput,
  Leaf,
  Map,
  PanelTop,
  Satellite,
  Wrench,
};

export function ToolsHub({
  myTools,
  moreTools,
  profile = "agrimensura",
}: {
  myTools: GeoGestaoTool[];
  moreTools: GeoGestaoTool[];
  profile?: OperationalProfile;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set([...myTools, ...moreTools].map((tool) => tool.category))).sort()],
    [myTools, moreTools],
  );

  const filteredMyTools = filterTools(myTools, query, category);
  const filteredMoreTools = filterTools(moreTools, query, category);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Perfil operacional ativo: <span className="font-medium text-foreground">{operationalProfileLabels[profile]}</span></p>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Buscar ferramenta por nome, categoria ou tag..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={category === item ? "default" : "outline"}
                onClick={() => setCategory(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <ToolSection
        title="Minhas ferramentas"
        description="Ferramentas liberadas para uso neste ambiente de teste."
        tools={filteredMyTools}
        emptyText="Nenhuma ferramenta liberada corresponde ao filtro atual."
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Mais ferramentas</h2>
          <p className="text-sm text-muted-foreground">
            Área preparada para marketplace e contratação futura por ferramenta.
          </p>
        </div>
        {filteredMoreTools.length ? (
          <ToolGrid tools={filteredMoreTools} />
        ) : (
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              {profile === "arquitetura" ? "Nenhuma ferramenta específica de Arquitetura liberada ainda." : profile === "agrimensura" ? "Todas as ferramentas estão liberadas neste ambiente de teste." : "Configure seus tipos de serviço e ferramentas para começar."}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function ToolSection({
  title,
  description,
  tools,
  emptyText,
}: {
  title: string;
  description: string;
  tools: GeoGestaoTool[];
  emptyText: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {tools.length ? (
        <ToolGrid tools={tools} />
      ) : (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">{emptyText}</CardContent>
        </Card>
      )}
    </section>
  );
}

function ToolGrid({ tools }: { tools: GeoGestaoTool[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.slug} tool={tool} />
      ))}
    </div>
  );
}

function ToolCard({ tool }: { tool: GeoGestaoTool }) {
  const Icon = icons[tool.iconName as keyof typeof icons] ?? Wrench;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-secondary p-2 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>{tool.name}</CardTitle>
              <CardDescription>{tool.category}</CardDescription>
            </div>
          </div>
          <Badge variant={tool.status === "unavailable" ? "destructive" : "secondary"}>
            {getToolStatusLabel(tool.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">{tool.shortDescription}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{getToolPricingLabel(tool.pricingMode)}</Badge>
          {tool.requiresWorker ? <Badge variant="outline">Requer worker</Badge> : null}
          {tool.requiresExternalConfig ? <Badge variant="outline">Requer configuração</Badge> : null}
          {tool.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button asChild>
            <Link href={tool.routePath}>Abrir</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={tool.routePath}>Detalhes</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function filterTools(tools: GeoGestaoTool[], query: string, category: string) {
  const normalizedQuery = normalizeText(query);
  return tools.filter((tool) => {
    const matchesCategory = category === "Todas" || tool.category === category;
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;
    const haystack = normalizeText(
      [tool.name, tool.shortDescription, tool.longDescription, tool.category, ...tool.tags].join(" "),
    );
    return haystack.includes(normalizedQuery);
  });
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
