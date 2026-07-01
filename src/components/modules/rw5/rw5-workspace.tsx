"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedRw5File } from "@/lib/modules/rw5/converter";

type Rw5Result = {
  resultText: string;
  filename: string;
  parsed: ParsedRw5File;
  persisted: boolean;
  warnings: string[];
};

export function Rw5Workspace() {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedRw5File | null>(null);
  const [result, setResult] = useState<Rw5Result | null>(null);
  const [loading, setLoading] = useState<"parse" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState("");
  const [crs, setCrs] = useState("EPSG:31982");
  const [equipment, setEquipment] = useState("auto");
  const [antennaRw5, setAntennaRw5] = useState("");
  const [hrOffset, setHrOffset] = useState("0.0813");

  async function parseFile() {
    if (!file) return;
    setLoading("parse");
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("crs", crs);
    const response = await fetch("/api/modules/rw5/parse", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);
    setLoading(null);
    if (!response.ok) {
      setError(data?.error ?? "Nao foi possivel ler o arquivo.");
      return;
    }
    setParsed(data);
    if (!antennaRw5 && data?.detectedAntennaType) setAntennaRw5(data.detectedAntennaType);
  }

  async function generateRw5() {
    if (!file) return;
    setLoading("generate");
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("outputFilename", outputFilename);
    formData.append("crs", crs);
    formData.append("equipment", equipment);
    formData.append("antennaRw5", antennaRw5);
    formData.append("hrOffset", hrOffset);
    const response = await fetch("/api/modules/rw5/generate", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);
    setLoading(null);
    if (!response.ok) {
      setError(data?.error ?? "Nao foi possivel gerar o RW5.");
      return;
    }
    setParsed(data.parsed);
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Gerador RW5</CardTitle>
          <CardDescription>Upload, CRS, equipamento, antena, previa e geracao do arquivo RW5.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Arquivo TXT</Label>
            <Input type="file" accept=".txt,.pts,.mc,.csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nome do RW5 de saida" value={outputFilename} onChange={setOutputFilename} placeholder="levantamento_final.rw5" />
            <label className="space-y-2 text-sm">
              <span className="font-medium">CRS UTM de origem</span>
              <select className="h-10 w-full rounded-md border bg-background px-3" value={crs} onChange={(event) => setCrs(event.target.value)}>
                <option value="EPSG:31982">EPSG:31982 - SIRGAS 2000 / UTM 22S</option>
                <option value="EPSG:31983">EPSG:31983 - SIRGAS 2000 / UTM 23S</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Modelo do equipamento</span>
              <select className="h-10 w-full rounded-md border bg-background px-3" value={equipment} onChange={(event) => setEquipment(event.target.value)}>
                <option value="auto">Auto/detectar</option>
                <option value="CHC i93">CHC i93</option>
                <option value="CHC i83">CHC i83</option>
                <option value="CHC i50">CHC i50</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <Field label="Tipo de antena RW5" value={antennaRw5} onChange={setAntennaRw5} placeholder="CHCI93 NONE" />
            <Field label="Offset HR/antena" value={hrOffset} onChange={setHrOffset} placeholder="0.0813" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={parseFile} disabled={!file || loading !== null}>
              {loading === "parse" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
              Pre-visualizar
            </Button>
            <Button type="button" onClick={generateRw5} disabled={!file || loading !== null}>
              {loading === "generate" ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Gerar RW5
            </Button>
            <Button type="button" variant="outline" onClick={downloadResult} disabled={!result}>
              <Download aria-hidden="true" />
              Download RW5
            </Button>
          </div>

          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

          <div className="rounded-md border bg-secondary/40 p-3 text-sm">
            <p className="font-medium">Configuracoes avancadas</p>
            <p className="mt-1 text-muted-foreground">
              O parser reconhece MC 19, PTS 24, exportacoes com 37 colunas e layout legado. Se o arquivo nao trouxer latitude/longitude, o modulo converte UTM SIRGAS para coordenadas RW5.
            </p>
          </div>

          <Preview parsed={parsed} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo e historico</CardTitle>
          <CardDescription>Jobs e arquivos usam organization_id e Storage em organizations/.../modules/gerador-rw5.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {parsed ? (
            <>
              <Info label="Formato detectado" value={parsed.inputFormat} />
              <Info label="Encoding" value={parsed.encoding} />
              <Info label="Delimitador" value={parsed.delimiter} />
              <Info label="Bases" value={String(parsed.baseCount)} />
              <Info label="Pontos" value={String(parsed.pointCount)} />
              <Info label="Antena detectada" value={parsed.detectedAntennaType ?? "-"} />
              <Info label="Equipamento sugerido" value={parsed.detectedEquipment ?? "-"} />
            </>
          ) : (
            <p className="text-muted-foreground">Envie um arquivo para ver deteccao, bases, pontos e warnings.</p>
          )}
          {result ? (
            <p className="rounded-md bg-secondary px-3 py-2">
              {result.persisted ? "Conversao salva no historico da organizacao." : "RW5 gerado; historico depende da migration do modulo."}
            </p>
          ) : null}
          {[...(parsed?.corrections ?? []), ...(result?.warnings ?? parsed?.warnings ?? [])].map((warning) => (
            <p key={warning} className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
              {warning}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Preview({ parsed }: { parsed: ParsedRw5File | null }) {
  if (!parsed) return <p className="text-sm text-muted-foreground">A previa dos pontos aparecera aqui.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead className="bg-secondary text-left">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Norte</th>
            <th className="px-3 py-2">Este</th>
            <th className="px-3 py-2">Altitude</th>
            <th className="px-3 py-2">HR</th>
            <th className="px-3 py-2">Tipo</th>
          </tr>
        </thead>
        <tbody>
          {parsed.preview.map((point) => (
            <tr key={`${point.line}-${point.id}`} className="border-t">
              <td className="px-3 py-2">{point.id}</td>
              <td className="px-3 py-2">{point.northing}</td>
              <td className="px-3 py-2">{point.easting}</td>
              <td className="px-3 py-2">{point.elevation}</td>
              <td className="px-3 py-2">{point.hrField}</td>
              <td className="px-3 py-2">{point.isBase ? "Base" : "Ponto"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
