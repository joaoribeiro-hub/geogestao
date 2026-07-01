"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedRtkFile } from "@/lib/modules/rtk-ppp/converter";

type CorrectionResult = {
  correction: { deltaN: number; deltaE: number; deltaH: number };
  preview: Array<{
    id: string;
    description?: string;
    correctedNorthing: number;
    correctedEasting: number;
    correctedElevation: number;
  }>;
  correctedPoints: Array<{
    id: string;
    description?: string;
    correctedNorthing: number;
    correctedEasting: number;
    correctedElevation: number;
  }>;
  resultText: string;
  filename: string;
  warnings: string[];
  persisted: boolean;
};

export function RtkPppWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedRtkFile | null>(null);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [loading, setLoading] = useState<"parse" | "correct" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [northing, setNorthing] = useState("");
  const [easting, setEasting] = useState("");
  const [elevation, setElevation] = useState("");
  const [decimals, setDecimals] = useState("4");
  const [outputDelimiter, setOutputDelimiter] = useState("tab");
  const [includeCorrectedBase, setIncludeCorrectedBase] = useState(true);

  async function parseFile() {
    if (!file) return;
    setLoading("parse");
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/modules/rtk-ppp/parse", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);
    setLoading(null);
    if (!response.ok) {
      setError(data?.error ?? "Nao foi possivel ler o arquivo.");
      return;
    }
    setParsed(data);
    if (data.base) {
      setNorthing(String(data.base.northing));
      setEasting(String(data.base.easting));
      setElevation(String(data.base.elevation));
    }
  }

  async function correctFile() {
    if (!file) return;
    setLoading("correct");
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("northing", northing);
    formData.append("easting", easting);
    formData.append("elevation", elevation);
    formData.append("decimals", decimals);
    formData.append("outputDelimiter", outputDelimiter);
    formData.append("includeCorrectedBase", String(includeCorrectedBase));
    const response = await fetch("/api/modules/rtk-ppp/correct", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);
    setLoading(null);
    if (!response.ok) {
      setError(data?.error ?? "Nao foi possivel calcular a correcao.");
      return;
    }
    setResult(data);
  }

  function downloadResult() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.resultText], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Corretor de Coordenadas RTK/PPP</h2>
            <p className="text-sm text-muted-foreground">Online no GeoGestao, com persistencia por organizacao quando a migration esta aplicada.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Funcional</span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>1. Arquivo TXT do levantamento</CardTitle>
              <CardDescription>Leia o arquivo original para detectar formato, encoding, delimitador, base e pontos rover.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Arquivo TXT do levantamento</Label>
                <Input type="file" accept=".txt,.csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={parseFile} disabled={!file || loading !== null}>
                  {loading === "parse" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
                  Ler arquivo
                </Button>
                <Button type="button" variant="outline" onClick={downloadResult} disabled={!result}>
                  <Download aria-hidden="true" />
                  Baixar TXT corrigido
                </Button>
              </div>
              {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>2. BASE LEVANTADA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Info label="ID original da base" value={parsed?.base?.id ?? "-"} />
                <Info label="NORTE" value={parsed?.base ? String(parsed.base.northing) : "-"} />
                <Info label="ESTE" value={parsed?.base ? String(parsed.base.easting) : "-"} />
                <Info label="ALTITUDE" value={parsed?.base ? String(parsed.base.elevation) : "-"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. BASE CORRIGIDA PPP/IBGE</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Field label="NORTE" value={northing} onChange={setNorthing} />
                <Field label="ESTE" value={easting} onChange={setEasting} />
                <Field label="ALTITUDE" value={elevation} onChange={setElevation} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>4. CORRECAO BASE</CardTitle>
              <CardDescription>Delta calculado: base corrigida PPP/IBGE menos base levantada.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Info label="DeltaN" value={result ? result.correction.deltaN.toFixed(Number(decimals)) : "-"} />
              <Info label="DeltaE" value={result ? result.correction.deltaE.toFixed(Number(decimals)) : "-"} />
              <Info label="DeltaH" value={result ? result.correction.deltaH.toFixed(Number(decimals)) : "-"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Configuracoes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Casas decimais</span>
                <select className="h-10 w-full rounded-md border bg-background px-3" value={decimals} onChange={(event) => setDecimals(event.target.value)}>
                  <option value="4">4</option>
                  <option value="3">3</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Delimitador de saida</span>
                <select className="h-10 w-full rounded-md border bg-background px-3" value={outputDelimiter} onChange={(event) => setOutputDelimiter(event.target.value)}>
                  <option value="tab">TAB</option>
                  <option value="comma">Virgula</option>
                  <option value="semicolon">Ponto e virgula</option>
                </select>
              </label>
              <label className="flex items-center gap-2 pt-7 text-sm">
                <input type="checkbox" checked={includeCorrectedBase} onChange={(event) => setIncludeCorrectedBase(event.target.checked)} />
                Incluir BASE corrigida
              </label>
              <Button type="button" className="mt-6" onClick={correctFile} disabled={!file || !parsed?.base || loading !== null}>
                {loading === "correct" ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Calcular correcao
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Resultado</CardTitle>
              <CardDescription>{result ? `${result.correctedPoints.length} ponto(s) processado(s).` : "A previa aparece depois do calculo."}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResultTable result={result} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Metricas da leitura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {parsed ? (
                <>
                  <Info label="Formato" value={parsed.format} />
                  <Info label="Encoding" value={parsed.encoding} />
                  <Info label="Delimitador" value={parsed.delimiter} />
                  <Info label="Base" value={parsed.base?.id ?? "Nao encontrada"} />
                  <Info label="Pontos rover" value={String(parsed.rovers.length)} />
                  <Info label="Linhas ignoradas" value={String(parsed.skippedLines)} />
                </>
              ) : (
                <p className="text-muted-foreground">Envie um TXT e clique em Ler arquivo.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[...(parsed?.warnings ?? []), ...(result?.warnings ?? [])].length ? (
                [...(parsed?.warnings ?? []), ...(result?.warnings ?? [])].map((warning) => (
                  <p key={warning} className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">{warning}</p>
                ))
              ) : (
                <p className="rounded-md bg-secondary px-3 py-2 text-muted-foreground">Nenhum alerta relevante.</p>
              )}
              {result ? (
                <p className="rounded-md bg-secondary px-3 py-2 text-muted-foreground">
                  {result.persisted ? "Job salvo no historico da organizacao." : "Resultado gerado; historico depende da migration do modulo."}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <Input value={value} inputMode="decimal" onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-md bg-secondary px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function ResultTable({ result }: { result: CorrectionResult | null }) {
  if (!result) return <p className="text-sm text-muted-foreground">Calcule a correcao para ver a tabela.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead className="bg-secondary text-left">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Norte corrigido</th>
            <th className="px-3 py-2">Este corrigido</th>
            <th className="px-3 py-2">Altitude corrigida</th>
            <th className="px-3 py-2">Descricao</th>
          </tr>
        </thead>
        <tbody>
          {result.preview.map((point) => (
            <tr key={point.id} className="border-t">
              <td className="px-3 py-2">{point.id}</td>
              <td className="px-3 py-2">{point.correctedNorthing}</td>
              <td className="px-3 py-2">{point.correctedEasting}</td>
              <td className="px-3 py-2">{point.correctedElevation}</td>
              <td className="px-3 py-2">{point.description ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
