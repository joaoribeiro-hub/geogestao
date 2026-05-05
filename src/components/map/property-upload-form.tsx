"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { kml } from "@tmcw/togeojson";
import JSZip from "jszip";
import { FileUp, Loader2 } from "lucide-react";
import { createPropertyGeometryAction } from "@/app/(app)/mapa/actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Client, ServiceCard } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PropertyUploadForm({
  clients,
  serviceCards,
}: {
  clients: Client[];
  serviceCards: ServiceCard[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function submit(formData: FormData) {
    startTransition(() => {
      void (async () => {
        setFeedback(null);
        const file = fileRef.current?.files?.[0];
        if (!file) {
          setFeedback({ type: "error", message: "Selecione um KML ou KMZ." });
          return;
        }

        try {
          const geojson = await parseKmlOrKmz(file);
          const supabase = createBrowserSupabase();
          const clientId = String(formData.get("client_id") ?? "sem-cliente");
          const safeName = file.name.replace(/[^\w.-]+/g, "-");
          const filePath = `mapa/${clientId}/${crypto.randomUUID()}-${safeName}`;
          const { error } = await supabase.storage
            .from("attachments")
            .upload(filePath, file);
          if (error) throw new Error(error.message);

          formData.set("file_path", filePath);
          formData.set("file_name", file.name);
          formData.set("mime_type", file.type || guessMimeType(file.name));
          formData.set("size_bytes", file.size.toString());
          formData.set("geojson", JSON.stringify(geojson));

          const result = await createPropertyGeometryAction(formData);
          setFeedback({ type: "success", message: result.message });
          if (fileRef.current) fileRef.current.value = "";
          router.refresh();
        } catch (error) {
          setFeedback({
            type: "error",
            message:
              error instanceof Error ? error.message : "Nao foi possivel processar o arquivo.",
          });
        }
      })();
    });
  }

  return (
    <form action={submit} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Cliente">
          <select
            name="client_id"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Servico/card tecnico">
          <select
            name="service_card_id"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Nao vincular</option>
            {serviceCards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Nome do imovel">
        <Input name="name" required />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Area">
          <Input name="area" type="number" step="0.0001" />
        </Field>
        <Field label="Matricula">
          <Input name="registry_number" />
        </Field>
        <Field label="Data da matricula">
          <Input name="registry_date" type="date" />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="CAR Estadual">
          <Input name="car_state" />
        </Field>
        <Field label="CAR Federal">
          <Input name="car_federal" />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
        <Field label="Municipio">
          <Input name="city" />
        </Field>
        <Field label="UF">
          <Input name="state" maxLength={2} />
        </Field>
      </div>

      <Field label="Observacoes">
        <Textarea name="notes" />
      </Field>

      <Field label="Arquivo KML/KMZ">
        <input ref={fileRef} type="file" accept=".kml,.kmz" className="text-sm" />
      </Field>

      <Button disabled={pending || !clients.length}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
        Enviar e exibir no mapa
      </Button>

      {feedback ? (
        <p
          className={`rounded-md p-2 text-sm ${
            feedback.type === "success"
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

async function parseKmlOrKmz(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let kmlText = "";

  if (extension === "kmz") {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const kmlFile = Object.values(zip.files).find(
      (item) => !item.dir && item.name.toLowerCase().endsWith(".kml"),
    );
    if (!kmlFile) throw new Error("KMZ sem arquivo KML interno.");
    kmlText = await kmlFile.async("text");
  } else if (extension === "kml") {
    kmlText = await file.text();
  } else {
    throw new Error("Envie um arquivo .kml ou .kmz.");
  }

  const dom = new DOMParser().parseFromString(kmlText, "text/xml");
  const parseError = dom.querySelector("parsererror");
  if (parseError) throw new Error("KML invalido.");

  const geojson = kml(dom);
  if (!geojson.features.length) {
    throw new Error("Nenhum perimetro encontrado no KML/KMZ.");
  }

  return geojson;
}

function guessMimeType(fileName: string) {
  return fileName.toLowerCase().endsWith(".kmz")
    ? "application/vnd.google-earth.kmz"
    : "application/vnd.google-earth.kml+xml";
}
