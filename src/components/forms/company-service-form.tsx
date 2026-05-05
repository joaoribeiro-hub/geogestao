"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  createCompanyServiceAction,
  updateCompanyServiceAction,
} from "@/app/(app)/minha-empresa/actions";
import {
  companyServiceSchema,
  type CompanyServiceFormValues,
} from "@/lib/schemas";
import type { CompanyService } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CompanyServiceForm({
  service,
}: {
  service?: CompanyService;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const form = useForm<CompanyServiceFormValues>({
    resolver: zodResolver(companyServiceSchema),
    defaultValues: {
      niche: service?.niche ?? "",
      name: service?.name ?? "",
      base_price: service?.base_price?.toString() ?? "",
      billing_unit: service?.billing_unit ?? "",
      description: service?.description ?? "",
      is_active: service?.is_active === false ? "false" : "true",
    },
  });

  function submit(values: CompanyServiceFormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) =>
      formData.set(key, value?.toString() ?? ""),
    );

    startTransition(() => {
      void (async () => {
        setFeedback(null);
        try {
          if (service) {
            await updateCompanyServiceAction(service.id, formData);
          } else {
            await createCompanyServiceAction(formData);
            form.reset({
              niche: values.niche,
              name: "",
              base_price: "",
              billing_unit: "",
              description: "",
              is_active: "true",
            });
          }
          setFeedback({ type: "success", message: "Servico salvo." });
          router.refresh();
        } catch (error) {
          setFeedback({
            type: "error",
            message:
              error instanceof Error ? error.message : "Nao foi possivel salvar o servico.",
          });
        }
      })();
    });
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="service-niche">Nicho de atuacao</Label>
          <Input id="service-niche" {...form.register("niche")} />
          {form.formState.errors.niche ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.niche.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="service-name">Servico oferecido</Label>
          <Input id="service-name" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr_150px]">
        <div className="space-y-2">
          <Label htmlFor="service-base-price">Preco base opcional</Label>
          <Input
            id="service-base-price"
            type="number"
            step="0.01"
            {...form.register("base_price")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="service-billing-unit">Unidade de cobranca</Label>
          <Input id="service-billing-unit" placeholder="ha, projeto, hora..." {...form.register("billing_unit")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="service-active">Status</Label>
          <select
            id="service-active"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("is_active")}
          >
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-description">Descricao</Label>
        <Textarea id="service-description" {...form.register("description")} />
      </div>

      <Button disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {service ? "Salvar servico" : "Cadastrar servico"}
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
