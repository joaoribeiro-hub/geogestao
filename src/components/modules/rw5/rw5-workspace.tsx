"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRw5EquipmentProfiles, type ParsedRw5File, type Rw5ValidationReport } from "@/lib/modules/rw5/converter";
import { equipmentProfileLabel, resolveRw5EquipmentProfile } from "@/lib/modules/rw5/equipment";

type Rw5Result = {
  resultText: string;
  filename: string;
  coordinatesText: string;
  coordinatesFilename: string;
  parsed: ParsedRw5File;
  persisted: boolean;
  warnings: string[];
  validation: Rw5ValidationReport;
};

const EQUIPMENT_PROFILES = getRw5EquipmentProfiles();

export function Rw5Workspace() {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedRw5File | null>(null);
  const [result, setResult] = useState<Rw5Result | null>(null);
  const [loading, setLoading] = useState<"parse" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState("");
  const [jobName, setJobName] = useState("");
  const [jobCreationDate, setJobCreationDate] = useState("");
  const [jobCreationTime, setJobCreationTime] = useState("");
  const [softwareVersion, setSoftwareVersion] = useState("8.2.0.1.20251117");
  const [crs, setCrs] = useState("EPSG:31982");
  const [equipment, setEquipment] = useState("auto");
  const [baseEquipment, setBaseEquipment] = useState("auto");
  const [baseHeightType, setBaseHeightType] = useState<"Vertical" | "Slant">("Vertical");
  const [defaultRoverHr, setDefaultRoverHr] = useState("1.700");
  const [defaultAge, setDefaultAge] = useState("");
  const generationBlockers = getGenerationBlockers(parsed, {
    jobName,
    jobCreationDate,
    jobCreationTime,
    equipment,
    baseEquipment,
  });
  const canGenerate = Boolean(file) && loading === null && generationBlockers.length === 0;

  async function parseFile() {
    if (!file) return;
    setLoading("parse");
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("crs", crs);
    formData.append("defaultRoverHr", defaultRoverHr);
    formData.append("defaultAge", defaultAge);
    const response = await fetch("/api/modules/rw5/parse", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);
    setLoading(null);
    if (!response.ok) {
      setError(data?.error ?? "Nao foi possivel ler o arquivo.");
      return;
    }
    setParsed(data);
    if (data?.baseMode === "registered_base") setBaseHeightType("Vertical");
    if (data?.baseMode === "linked_base") setBaseHeightType("Slant");
  }

  async function generateRw5() {
    if (!file) return;
    setLoading("generate");
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("outputFilename", outputFilename);
    formData.append("jobName", jobName);
    formData.append("jobCreationDate", jobCreationDate);
    formData.append("jobCreationTime", jobCreationTime);
    formData.append("softwareVersion", softwareVersion);
    formData.append("crs", crs);
    formData.append("equipment", equipment);
    formData.append("baseEquipment", baseEquipment);
    formData.append("baseHeightType", baseHeightType);
    formData.append("defaultRoverHr", defaultRoverHr);
    formData.append("defaultAge", defaultAge);
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

  function downloadCoordinates() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.coordinatesText], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.coordinatesFilename;
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
            <Label>Arquivo TXT/PTS/MC/CSV/XLSX</Label>
            <Input type="file" accept=".txt,.pts,.mc,.csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nome do RW5 de saida" value={outputFilename} onChange={setOutputFilename} placeholder="levantamento_final.rw5" />
            <Field label="Nome da obra no RW5" value={jobName} onChange={setJobName} placeholder="GO-419-MP02-JOSIVALDO" />
            <Field label="Data de criacao da obra" value={jobCreationDate} onChange={setJobCreationDate} type="date" />
            <Field label="Hora de criacao da obra" value={jobCreationTime} onChange={setJobCreationTime} type="time" />
            <Field label="Software Version RW5" value={softwareVersion} onChange={setSoftwareVersion} />
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
              <span className="font-medium">Perfil do rover</span>
              <select className="h-10 w-full rounded-md border bg-background px-3" value={equipment} onChange={(event) => setEquipment(event.target.value)}>
                <option value="auto">Auto/detectar quando houver um unico perfil</option>
                {EQUIPMENT_PROFILES.map((profile) => <option key={profile.key} value={profile.key}>{equipmentProfileLabel(profile)}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Perfil da base</span>
              <select className="h-10 w-full rounded-md border bg-background px-3" value={baseEquipment} onChange={(event) => setBaseEquipment(event.target.value)}>
                <option value="auto">Auto/detectar</option>
                {EQUIPMENT_PROFILES.map((profile) => <option key={profile.key} value={profile.key}>{equipmentProfileLabel(profile)}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Medicao da altura da base</span>
              <select className="h-10 w-full rounded-md border bg-background px-3" value={baseHeightType} onChange={(event) => setBaseHeightType(event.target.value as "Vertical" | "Slant")}>
                <option value="Vertical">Vertical</option>
                <option value="Slant">Slant</option>
              </select>
            </label>
            <Field label="HR rover padrao" value={defaultRoverHr} onChange={setDefaultRoverHr} placeholder="1.700" />
            <Field label="AGE padrao (opcional)" value={defaultAge} onChange={setDefaultAge} placeholder="Vazio = nao preencher" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={parseFile} disabled={!file || loading !== null}>
              {loading === "parse" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
              Pre-visualizar
            </Button>
            <Button type="button" onClick={generateRw5} disabled={!canGenerate}>
              {loading === "generate" ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Gerar RW5
            </Button>
            <Button type="button" variant="outline" onClick={downloadResult} disabled={!result}>
              <Download aria-hidden="true" />
              Download RW5
            </Button>
            <Button type="button" variant="outline" onClick={downloadCoordinates} disabled={!result}>
              <Download aria-hidden="true" />
              Baixar latitude / longitude
            </Button>
          </div>

          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          {generationBlockers.length ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p className="font-medium">Antes de gerar o RW5:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {generationBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="rounded-md border bg-secondary/40 p-3 text-sm">
            <p className="font-medium">Configuracoes avancadas</p>
            <p className="mt-1 text-muted-foreground">
              O parser reconhece MC 19, PTS 24, exportacoes com 37 colunas, planilhas XLSX e layout legado. Se o arquivo nao trouxer latitude/longitude, o modulo converte UTM SIRGAS para coordenadas RW5.
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
              <Info label="Ordem detectada" value={parsed.coordinateOrder ?? "-"} />
              <Info label="Modo de base" value={parsed.baseMode ?? "-"} />
              <Info label="Base usada" value={parsed.baseUsed ?? "-"} />
              <Info label="Bases" value={String(parsed.baseCount)} />
              <Info label="Pontos" value={String(parsed.pointCount)} />
              <Info label="Pontos de controle" value={String(parsed.controlPointCount ?? 0)} />
              <Info label="IDs alfanumericos" value={String(parsed.alphanumericPointCount ?? 0)} />
              <Info label="Antena detectada" value={parsed.detectedAntennaType ?? "-"} />
              <Info label="Antena da base" value={parsed.detectedBaseAntennaType ?? "-"} />
              <Info label="Equipamento sugerido" value={parsed.detectedEquipment ?? "-"} />
              <Info label="Lat/Lon calculadas" value={String(parsed.validation.lat_lon_calculadas)} />
              <Info label="TDOP calculado" value={String(parsed.validation.tdop_calculado)} />
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
          {(result?.validation.erros_bloqueantes ?? parsed?.validation.erros_bloqueantes ?? []).map((blockingError) => (
            <p key={blockingError} className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">
              {blockingError}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function getGenerationBlockers(
  parsed: ParsedRw5File | null,
  values: {
    jobName: string;
    jobCreationDate: string;
    jobCreationTime: string;
    equipment: string;
    baseEquipment: string;
  },
) {
  const blockers = new Set<string>();
  if (!values.jobName.trim()) blockers.add("Preencha o Nome da obra no RW5.");
  if (!values.jobCreationDate.trim() || !values.jobCreationTime.trim()) blockers.add("Preencha a data e a hora de criacao da obra.");
  if (!parsed) return [...blockers];
  parsed.validation.erros_bloqueantes.forEach((blocker) => blockers.add(blocker));

  try {
    resolveRw5EquipmentProfile({
      selected: values.equipment,
      detected: parsed.detectedAntennaType ?? parsed.detectedEquipment,
      role: "rover",
    });
  } catch (error) {
    blockers.add(error instanceof Error ? error.message : "Selecione um perfil valido para o rover.");
  }

  if (parsed.baseMode === "registered_base") {
    try {
      resolveRw5EquipmentProfile({
        selected: values.baseEquipment,
        detected: parsed.detectedBaseAntennaType,
        role: "base",
      });
    } catch (error) {
      blockers.add(error instanceof Error ? error.message : "Selecione um perfil valido para a base.");
    }
  }

  return [...blockers];
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
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
