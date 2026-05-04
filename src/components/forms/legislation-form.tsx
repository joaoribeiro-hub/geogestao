"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { createLegislationAction } from "@/app/(app)/legislacao/actions";
import { legislationSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Values = {
  title: string;
  category: string;
  official_link?: string;
  technical_summary?: string;
  practical_points?: string;
  status: "vigente" | "revogado" | "atencao";
};

export function LegislationForm() {
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(legislationSchema),
    defaultValues: {
      title: "",
      category: "",
      official_link: "",
      technical_summary: "",
      practical_points: "",
      status: "vigente",
    },
  });

  function submit(values: Values) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => formData.set(key, value ?? ""));
    startTransition(() => {
      void createLegislationAction(formData);
      form.reset({
        title: "",
        category: "",
        official_link: "",
        technical_summary: "",
        practical_points: "",
        status: "vigente",
      });
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
      <div className="space-y-2">
        <Label>Link oficial</Label>
        <Input type="url" {...form.register("official_link")} />
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...form.register("status")}>
          <option value="vigente">Vigente</option>
          <option value="atencao">Requer atencao</option>
          <option value="revogado">Revogado</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label>Resumo tecnico</Label>
        <Textarea {...form.register("technical_summary")} />
      </div>
      <div className="space-y-2">
        <Label>Pontos praticos</Label>
        <Textarea {...form.register("practical_points")} />
      </div>
      <Button disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        Criar legislacao
      </Button>
    </form>
  );
}
