"use client";

import { useMemo, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  calculatePerimeter,
  createDxf,
  formatAngle,
  type BoundaryInput,
  type DeflectionSide,
  type PerimeterResult,
  type SurveyMode,
} from "@/lib/tools/desenhar-geo/geometry";

type EditableRow = {
  id: string;
  direction: string;
  distance: string;
  confrontant: string;
  deflectionSide: DeflectionSide;
};

const initialRows: EditableRow[] = [
  { id: "1", direction: "0", distance: "100", confrontant: "Confrontante 1", deflectionSide: "right" },
  { id: "2", direction: "90", distance: "100", confrontant: "Confrontante 2", deflectionSide: "right" },
  { id: "3", direction: "180", distance: "100", confrontant: "Confrontante 3", deflectionSide: "right" },
  { id: "4", direction: "270", distance: "100", confrontant: "Confrontante 4", deflectionSide: "right" },
];

export function DesenharGeoWorkspace() {
  const [mode, setMode] = useState<SurveyMode>("azimuth");
  const [spatialReference, setSpatialReference] = useState<"local" | "georeferenced">("local");
  const [initialEasting, setInitialEasting] = useState("0");
  const [initialNorthing, setInitialNorthing] = useState("0");
  const [initialAzimuth, setInitialAzimuth] = useState("0");
  const [epsg, setEpsg] = useState("");
  const [rows, setRows] = useState(initialRows);
  const [result, setResult] = useState<PerimeterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const boundaryInputs = useMemo<BoundaryInput[]>(
    () =>
      rows.map((row, index) => ({
        startVertex: `V${String(index + 1).padStart(2, "0")}`,
        endVertex: `V${String(index + 2).padStart(2, "0")}`,
        direction: row.direction,
        distance: Number(row.distance.replace(",", ".")),
        confrontant: row.confrontant,
        deflectionSide: row.deflectionSide,
      })),
    [rows],
  );

  function calculate() {
    setError(null);
    try {
      const next = calculatePerimeter({
        mode,
        rows: boundaryInputs,
        initialEasting: Number(initialEasting.replace(",", ".")),
        initialNorthing: Number(initialNorthing.replace(",", ".")),
        initialAzimuth,
      });
      setResult(next);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Não foi possível calcular o perímetro.");
    }
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        direction: mode === "bearing" ? "N 45 E" : "90",
        distance: "100",
        confrontant: "",
        deflectionSide: "right",
      },
    ]);
  }

  function updateRow(id: string, field: keyof EditableRow, value: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function downloadDxf() {
    if (!result) return;
    const blob = new Blob([createDxf(result)], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "perimetro.dxf";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Entrada do perímetro</CardTitle>
            <CardDescription>
              Calcule localmente por azimute, rumo ou deflexão. KML só será liberado quando houver georreferenciamento real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Tipo de levantamento">
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as SurveyMode)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="azimuth">Azimute + distância</option>
                  <option value="bearing">Rumo + distância</option>
                  <option value="deflection">Deflexão + distância</option>
                </select>
              </Field>
              <Field label="Referência espacial">
                <select
                  value={spatialReference}
                  onChange={(event) => setSpatialReference(event.target.value as "local" | "georeferenced")}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="local">Local</option>
                  <option value="georeferenced">Georreferenciado</option>
                </select>
              </Field>
              {mode === "deflection" ? (
                <Field label="Azimute inicial">
                  <Input value={initialAzimuth} onChange={(event) => setInitialAzimuth(event.target.value)} />
                </Field>
              ) : null}
              <Field label="Este inicial">
                <Input value={initialEasting} onChange={(event) => setInitialEasting(event.target.value)} />
              </Field>
              <Field label="Norte inicial">
                <Input value={initialNorthing} onChange={(event) => setInitialNorthing(event.target.value)} />
              </Field>
              {spatialReference === "georeferenced" ? (
                <Field label="EPSG">
                  <Input value={epsg} onChange={(event) => setEpsg(event.target.value)} placeholder="Ex.: 31982" />
                </Field>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-secondary text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Vértices</th>
                    <th className="px-3 py-2 text-left">{mode === "bearing" ? "Rumo" : mode === "deflection" ? "Deflexão" : "Azimute"}</th>
                    {mode === "deflection" ? <th className="px-3 py-2 text-left">Lado</th> : null}
                    <th className="px-3 py-2 text-left">Distância (m)</th>
                    <th className="px-3 py-2 text-left">Confrontante</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} className="border-t">
                      <td className="whitespace-nowrap px-3 py-2">
                        V{String(index + 1).padStart(2, "0")} → V{String(index + 2).padStart(2, "0")}
                      </td>
                      <td className="px-3 py-2">
                        <Input value={row.direction} onChange={(event) => updateRow(row.id, "direction", event.target.value)} />
                      </td>
                      {mode === "deflection" ? (
                        <td className="px-3 py-2">
                          <select
                            value={row.deflectionSide}
                            onChange={(event) => updateRow(row.id, "deflectionSide", event.target.value)}
                            className="h-10 rounded-md border bg-background px-2 text-sm"
                          >
                            <option value="right">Direita</option>
                            <option value="left">Esquerda</option>
                          </select>
                        </td>
                      ) : null}
                      <td className="px-3 py-2">
                        <Input value={row.distance} onChange={(event) => updateRow(row.id, "distance", event.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={row.confrontant} onChange={(event) => updateRow(row.id, "confrontant", event.target.value)} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(row.id)}>
                          <Trash2 aria-hidden="true" />
                          <span className="sr-only">Remover linha</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={addRow}>
                <Plus aria-hidden="true" />
                Adicionar divisa
              </Button>
              <Button type="button" onClick={calculate}>
                Calcular perímetro
              </Button>
              <Button type="button" variant="outline" onClick={downloadDxf} disabled={!result}>
                <Download aria-hidden="true" />
                Baixar DXF
              </Button>
              <Button type="button" variant="outline" disabled>
                KML requer georreferenciamento real
              </Button>
            </div>
          </CardContent>
        </Card>

        {result ? <ResultTables result={result} /> : null}
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Visualização local</CardTitle>
            <CardDescription>SVG em coordenadas locais/projetadas, sem jogar 0,0 em mapa geográfico.</CardDescription>
          </CardHeader>
          <CardContent>{result ? <PerimeterSvg result={result} /> : <EmptyPreview />}</CardContent>
        </Card>

        {result ? (
          <Card>
            <CardHeader>
              <CardTitle>Fechamento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Metric label="ΔE" value={`${result.deltaE.toFixed(3)} m`} />
              <Metric label="ΔN" value={`${result.deltaN.toFixed(3)} m`} />
              <Metric label="Erro linear" value={`${result.closureError.toFixed(3)} m`} />
              <Metric label="Perímetro" value={`${result.perimeter.toFixed(2)} m`} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function ResultTables({ result }: { result: PerimeterResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultado calculado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Vértice</th>
                <th className="px-3 py-2 text-left">Este</th>
                <th className="px-3 py-2 text-left">Norte</th>
              </tr>
            </thead>
            <tbody>
              {result.vertices.map((vertex) => (
                <tr key={vertex.name} className="border-t">
                  <td className="px-3 py-2 font-medium">{vertex.name}</td>
                  <td className="px-3 py-2">{vertex.easting.toFixed(3)}</td>
                  <td className="px-3 py-2">{vertex.northing.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Divisa</th>
                <th className="px-3 py-2 text-left">Azimute</th>
                <th className="px-3 py-2 text-left">Distância</th>
                <th className="px-3 py-2 text-left">Confrontante</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((line) => (
                <tr key={`${line.start}-${line.end}`} className="border-t">
                  <td className="px-3 py-2 font-medium">{line.start} → {line.end}</td>
                  <td className="px-3 py-2">{formatAngle(line.azimuth)}</td>
                  <td className="px-3 py-2">{line.distance.toFixed(2)} m</td>
                  <td className="px-3 py-2">{line.confrontant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PerimeterSvg({ result }: { result: PerimeterResult }) {
  const xs = result.vertices.map((vertex) => vertex.easting);
  const ys = result.vertices.map((vertex) => vertex.northing);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const points = result.vertices
    .map((vertex) => {
      const x = 20 + ((vertex.easting - minX) / width) * 260;
      const y = 280 - ((vertex.northing - minY) / height) * 260;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 300 300" className="aspect-square w-full rounded-md border bg-background">
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" />
      {result.vertices.map((vertex) => {
        const x = 20 + ((vertex.easting - minX) / width) * 260;
        const y = 280 - ((vertex.northing - minY) / height) * 260;
        return (
          <g key={vertex.name}>
            <circle cx={x} cy={y} r="4" fill="hsl(var(--primary))" />
            <text x={x + 6} y={y - 6} fontSize="10" fill="currentColor">
              {vertex.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function EmptyPreview() {
  return (
    <div className="flex aspect-square items-center justify-center rounded-md border bg-secondary text-sm text-muted-foreground">
      Calcule o perímetro para visualizar o desenho.
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
