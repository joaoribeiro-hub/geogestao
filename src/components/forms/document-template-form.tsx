"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { createDocumentTemplateAction } from "@/app/(app)/documentos/actions";
import { documentTemplateSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Values = {
  title: string;
  category: string;
  version: string;
  status: "vigente" | "obsoleto";
  description?: string;
  file_path?: string;
};

export function DocumentTemplateForm() {
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(documentTemplateSchema),
    defaultValues: {
      title: "",
      category: "",
      version: "1.0",
      status: "vigente",
      description: "",
      file_path: "",
    },
  });

  function submit(values: Values) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => formData.set(key, value ?? ""));
    startTransition(() => {
      void createDocumentTemplateAction(formData);
      form.reset({ ...values, title: "", category: "", description: "", file_path: "" });
    });
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Titulo</Label>
          <Input {...form.register("title")} />
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Input {...form.register("category")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Versao</Label>
          <Input {...form.register("version")} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...form.register("status")}>
            <option value="vigente">Vigente</option>
            <option value="obsoleto">Obsoleto</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Caminho do arquivo</Label>
        <Input placeholder="Opcional: use a tela Anexos para upload" {...form.register("file_path")} />
      </div>
      <div className="space-y-2">
        <Label>Descricao</Label>
        <Textarea {...form.register("description")} />
      </div>
      <Button disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        Criar documento
      </Button>
    </form>
  );
}
