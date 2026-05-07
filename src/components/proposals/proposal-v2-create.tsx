"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileUp, Loader2, Plus, Wand2 } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  createProposalFromPdfAction,
  createProposalModelDraftAction,
} from "@/app/(app)/propostas/actions";
import { proposalServiceTypes, proposalStages } from "@/lib/constants";
import {
  proposalModelDraftSchema,
  proposalPdfSchema,
  type ProposalModelDraftFormValues,
  type ProposalPdfFormValues,
} from "@/lib/schemas";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Client } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProposalV2Create({ clients }: { clients: Client[] }) {
  const [mode, setMode] = useState<"closed" | "pdf" | "model">("closed");

  return (
    <div className="relative">
      <Button
        type="button"
        data-testid="new-proposal-button"
        disabled={!clients.length}
        onClick={() => setMode((current) => (current === "closed" ? "pdf" : "closed"))}
      >
        <Plus aria-hidden="true" />
        Nova Proposta
      </Button>

      {mode !== "closed" ? (
        <Card className="absolute right-0 z-20 mt-2 w-[min(92vw,560px)] shadow-lg">
          <CardHeader>
            <CardTitle>Nova proposta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                data-testid="proposal-pdf-mode"
                variant={mode === "pdf" ? "default" : "outline"}
                onClick={() => setMode("pdf")}
              >
                <FileUp aria-hidden="true" />
                Anexar PDF existente
              </Button>
              <Button
                type="button"
                data-testid="proposal-model-mode"
                variant={mode === "model" ? "default" : "outline"}
                onClick={() => setMode("model")}
              >
                <Wand2 aria-hidden="true" />
                Criar usando modelo
              </Button>
            </div>

            {mode === "pdf" ? <ProposalPdfForm clients={clients} /> : null}
            {mode === "model" ? <ProposalModelDraftForm clients={clients} /> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ProposalPdfForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const form = useForm<ProposalPdfFormValues>({
    resolver: zodResolver(proposalPdfSchema.omit({
      file_path: true,
      file_name: true,
      mime_type: true,
      size_bytes: true,
    })),
    defaultValues: {
      client_id: clients[0]?.id ?? "",
      title: "",
      value: null,
      valid_until: "",
      stage: "sent",
      service_type: "georreferenciamento",
      comments: "",
    },
  });

  function submit(values: ProposalPdfFormValues) {
    startTransition(() => {
      void (async () => {
        setFeedback(null);
        const file = fileRef.current?.files?.[0];
        if (!file) {
          setFeedback({ type: "error", message: "Selecione o arquivo PDF." });
          return;
        }
        if (file.type && file.type !== "application/pdf") {
          setFeedback({ type: "error", message: "Envie um arquivo PDF." });
          return;
        }

        try {
          const supabase = createBrowserSupabase();
          const safeName = file.name.replace(/[^\w.-]+/g, "-");
          const filePath = `proposal/${values.client_id}/${crypto.randomUUID()}-${safeName}`;
          const { error } = await supabase.storage
            .from("attachments")
            .upload(filePath, file);
          if (error) throw new Error(error.message);

          const formData = new FormData();
          Object.entries(values).forEach(([key, value]) =>
            formData.set(key, value?.toString() ?? ""),
          );
          formData.set("file_path", filePath);
          formData.set("file_name", file.name);
          formData.set("mime_type", file.type || "application/pdf");
          formData.set("size_bytes", file.size.toString());

          const result = await createProposalFromPdfAction(formData);
          setFeedback({ type: "success", message: result.message });
          form.reset({
            client_id: values.client_id,
            title: "",
            value: null,
            valid_until: "",
            stage: "sent",
            service_type: values.service_type,
            comments: "",
          });
          if (fileRef.current) fileRef.current.value = "";
          router.refresh();
        } catch (error) {
          setFeedback({
            type: "error",
            message:
              error instanceof Error ? error.message : "Nao foi possivel anexar a proposta.",
          });
        }
      })();
    });
  }

  return (
    <form className="grid gap-4" data-testid="proposal-pdf-form" onSubmit={form.handleSubmit(submit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            data-testid="proposal-pdf-client"
            {...form.register("client_id")}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status inicial">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            data-testid="proposal-pdf-stage"
            {...form.register("stage")}
          >
            {proposalStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Titulo/nome do empreendimento">
        <Input data-testid="proposal-pdf-title" {...form.register("title")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Valor">
          <Input data-testid="proposal-pdf-value" type="number" step="0.01" {...form.register("value")} />
        </Field>
        <Field label="Validade">
          <Input data-testid="proposal-pdf-valid-until" type="date" {...form.register("valid_until")} />
        </Field>
        <Field label="Tipo de servico">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            data-testid="proposal-pdf-service-type"
            {...form.register("service_type")}
          >
            {proposalServiceTypes.map((serviceType) => (
              <option key={serviceType.id} value={serviceType.id}>
                {serviceType.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Arquivo PDF">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="text-sm"
          data-testid="proposal-pdf-file"
        />
      </Field>

      <Field label="Observacoes">
        <Textarea data-testid="proposal-pdf-comments" {...form.register("comments")} />
      </Field>

      <Button data-testid="proposal-pdf-submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
        Salvar PDF
      </Button>
      <Feedback feedback={feedback} />
    </form>
  );
}

function ProposalModelDraftForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const form = useForm<ProposalModelDraftFormValues>({
    resolver: zodResolver(proposalModelDraftSchema),
    defaultValues: {
      client_id: clients[0]?.id ?? "",
      title: "",
      service_type: "georreferenciamento",
      demand: "",
      sent_at: "",
      valid_until: "",
      value: null,
      sections: "",
      model_name: "Modelo padrao comercial",
    },
  });

  function submit(values: ProposalModelDraftFormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      formData.set(key, value?.toString() ?? ""),
    );

    startTransition(() => {
      void (async () => {
        setFeedback(null);
        try {
          const result = await createProposalModelDraftAction(formData);
          setFeedback({ type: "success", message: result.message });
          form.reset({
            client_id: values.client_id,
            title: "",
            service_type: values.service_type,
            demand: "",
            sent_at: "",
            valid_until: "",
            value: null,
            sections: "",
            model_name: values.model_name,
          });
          router.refresh();
        } catch (error) {
          setFeedback({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Nao foi possivel criar o rascunho.",
          });
        }
      })();
    });
  }

  return (
    <form className="grid gap-4" data-testid="proposal-model-form" onSubmit={form.handleSubmit(submit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Registro">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            data-testid="proposal-model-client"
            {...form.register("client_id")}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Modelo">
          <Input data-testid="proposal-model-name" {...form.register("model_name")} />
        </Field>
      </div>

      <Field label="Registro - titulo">
        <Input data-testid="proposal-model-title" {...form.register("title")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Demanda">
          <Textarea data-testid="proposal-model-demand" {...form.register("demand")} />
        </Field>
        <Field label="Secoes">
          <Textarea
            data-testid="proposal-model-sections"
            placeholder="Escopo, entregaveis, condicoes..."
            {...form.register("sections")}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Tipo de servico">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            data-testid="proposal-model-service-type"
            {...form.register("service_type")}
          >
            {proposalServiceTypes.map((serviceType) => (
              <option key={serviceType.id} value={serviceType.id}>
                {serviceType.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prazos - envio">
          <Input data-testid="proposal-model-sent-at" type="date" {...form.register("sent_at")} />
        </Field>
        <Field label="Prazos - validade">
          <Input data-testid="proposal-model-valid-until" type="date" {...form.register("valid_until")} />
        </Field>
        <Field label="Financeiro - valor">
          <Input data-testid="proposal-model-value" type="number" step="0.01" {...form.register("value")} />
        </Field>
      </div>

      <Button data-testid="proposal-model-submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Wand2 aria-hidden="true" />}
        Salvar rascunho
      </Button>
      <Feedback feedback={feedback} />
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

function Feedback({
  feedback,
}: {
  feedback: { type: "success" | "error"; message: string } | null;
}) {
  if (!feedback) return null;

  return (
    <p
      className={`rounded-md p-2 text-sm ${
        feedback.type === "success"
          ? "bg-primary/10 text-primary"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {feedback.message}
    </p>
  );
}
