import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

const dateString = z
  .string()
  .optional()
  .transform((value) => (value ? value : null));

export const clientSchema = z.object({
  kind: z.enum(["pf", "pj"]),
  name: z.string().trim().min(2, "Informe o nome do cliente."),
  document: optionalText,
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .pipe(z.string().email("E-mail invalido.").nullable()),
  phone: optionalText,
  address: optionalText,
  notes: optionalText,
});

export const interactionSchema = z.object({
  client_id: z.string().uuid(),
  type: z.enum(["ligacao", "email", "reuniao", "whatsapp", "nota"]),
  occurred_at: z.string().min(1, "Informe a data."),
  description: z.string().trim().min(3, "Descreva a interacao."),
});

export const proposalSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente."),
  title: z.string().trim().min(3, "Informe o titulo."),
  description: optionalText,
  value: z.coerce.number().nonnegative().nullable().optional(),
  sent_at: dateString,
  valid_until: dateString,
  comments: optionalText,
});

export const serviceCardSchema = z.object({
  column_id: z.string().uuid("Selecione uma coluna."),
  client_id: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  title: z.string().trim().min(3, "Informe o titulo."),
  description: optionalText,
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_date: dateString,
  custom_fields_json: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return {};
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "JSON invalido.",
        });
        return z.NEVER;
      }
    }),
});

export const checklistSchema = z.object({
  service_card_id: z.string().uuid(),
  title: z.string().trim().min(2, "Informe o nome do checklist."),
});

export const checklistItemSchema = z.object({
  checklist_id: z.string().uuid(),
  title: z.string().trim().min(2, "Informe o item."),
  is_done: z.coerce.boolean().optional().default(false),
});

export const financeSchema = z.object({
  client_id: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  proposal_id: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  service_card_id: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  description: z.string().trim().min(3, "Informe a descricao."),
  category: z.string().trim().min(2, "Informe a categoria."),
  amount: z.coerce.number().positive("Informe um valor positivo."),
  due_date: z.string().min(1, "Informe o vencimento."),
  paid_at: dateString,
  status: z.enum(["pending", "paid", "overdue"]),
});

export const documentTemplateSchema = z.object({
  title: z.string().trim().min(3, "Informe o titulo."),
  category: z.string().trim().min(2, "Informe a categoria."),
  version: z.string().trim().min(1, "Informe a versao."),
  status: z.enum(["vigente", "obsoleto"]),
  description: optionalText,
  file_path: optionalText,
});

export const legislationSchema = z.object({
  title: z.string().trim().min(3, "Informe o titulo."),
  category: z.string().trim().min(2, "Informe a categoria."),
  official_link: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .pipe(z.string().url("Link invalido.").nullable()),
  technical_summary: optionalText,
  practical_points: optionalText,
  status: z.enum(["vigente", "revogado", "atencao"]),
});

export const attachmentSchema = z.object({
  entity_type: z.enum([
    "client",
    "proposal",
    "service_card",
    "contract",
    "revenue",
    "expense",
    "document_template",
    "legislation_item",
  ]),
  entity_id: z.string().uuid(),
  file_path: z.string().min(1),
  file_name: z.string().min(1),
  mime_type: optionalText,
  size_bytes: z.coerce.number().nullable().optional(),
});

export type ClientFormValues = z.input<typeof clientSchema>;
export type ProposalFormValues = z.input<typeof proposalSchema>;
export type ServiceCardFormValues = z.input<typeof serviceCardSchema>;
export type FinanceFormValues = z.input<typeof financeSchema>;
