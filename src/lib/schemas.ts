import { z } from "zod";
import { isValidCarCode, normalizeCarCode } from "@/lib/geoquery";
import { parseBrlCurrencyInput } from "@/lib/services/service-finance";

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

export const companySettingsSchema = z.object({
  trade_name: optionalText,
  legal_name: optionalText,
  cnpj: optionalText,
  phone: optionalText,
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .pipe(z.string().email("E-mail invalido.").nullable()),
  website: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .pipe(z.string().url("Site invalido.").nullable()),
  address: optionalText,
  city: optionalText,
  state: optionalText,
  logo_url: optionalText,
  notes: optionalText,
});

export const companyBankSettingsSchema = z.object({
  bank_name: optionalText,
  bank_agency: optionalText,
  bank_account: optionalText,
  bank_account_type: optionalText,
  pix_key: optionalText,
  bank_account_holder: optionalText,
  bank_holder_document: optionalText,
  bank_notes: optionalText,
  payment_instructions: optionalText,
});

export const teamMemberSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do membro."),
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .pipe(z.string().email("E-mail invalido.").nullable()),
  document_number: optionalText,
  pix_key: optionalText,
  bank_name: optionalText,
  bank_agency: optionalText,
  bank_account: optionalText,
  monthly_amount: z
    .string()
    .optional()
    .transform((value) => (value ? parseBrlCurrencyInput(value) : null))
    .pipe(z.number().nonnegative("Informe um valor valido.").nullable()),
  role_title: optionalText,
  notes: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome completo."),
  phone: optionalText,
  birth_date: dateString,
  document_type: optionalText,
  document_number: optionalText,
  avatar_path: optionalText,
  email_preferences: z.object({
    summaries: z.coerce.boolean().default(false),
    special_dates: z.coerce.boolean().default(false),
    projects: z.coerce.boolean().default(false),
    proposals: z.coerce.boolean().default(false),
    finance: z.coerce.boolean().default(false),
  }),
  account_preferences: z.object({
    compact_mode: z.coerce.boolean().default(false),
  }),
});

const aiChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .trim()
    .min(1, "Digite uma mensagem.")
    .max(1200, "Mensagem muito longa. Use ate 1200 caracteres."),
});

export const aiChatSchema = z
  .object({
    message: aiChatMessageSchema.shape.content.optional(),
    messages: z.array(aiChatMessageSchema).max(12).optional(),
  })
  .refine((value) => Boolean(value.message || value.messages?.length), {
    message: "Digite uma mensagem.",
  });

export const companyServiceSchema = z.object({
  niche: z.string().trim().min(2, "Informe o nicho de atuacao."),
  name: z.string().trim().min(2, "Informe o servico oferecido."),
  base_price: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(z.number().nonnegative("Informe um preco valido.").nullable()),
  billing_unit: optionalText,
  description: optionalText,
  is_active: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export const propertyMapSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente."),
  service_card_id: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  name: z.string().trim().min(2, "Informe o nome do imovel."),
  area: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(z.number().nonnegative("Informe uma area valida.").nullable()),
  registry_number: optionalText,
  registry_date: dateString,
  car_state: optionalText,
  car_federal: optionalText,
  city: optionalText,
  state: optionalText,
  notes: optionalText,
  file_path: z.string().min(1, "Envie um arquivo KML ou KMZ."),
  file_name: z.string().min(1),
  mime_type: optionalText,
  size_bytes: z.coerce.number().nullable().optional(),
  geojson: z.string().min(1, "GeoJSON nao foi gerado."),
});

export const geoQuerySearchSchema = z.object({
  codCar: z
    .string()
    .trim()
    .min(1, "Informe o numero do CAR Federal.")
    .transform(normalizeCarCode)
    .refine(isValidCarCode, "Informe um numero de CAR Federal valido."),
  clientId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .transform((value) => value || null),
  serviceCardId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .transform((value) => value || null),
  propertyId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .transform((value) => value || null),
  bufferMeters: z.coerce.number().min(0).max(10000).default(500),
  includeNearbyAlerts: z.coerce.boolean().default(false),
  sigefMinOverlap: z.coerce.number().min(1).max(100).default(60),
  sigefBufferMeters: z.coerce.number().min(0).max(10000).default(0),
});

export const proposalSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente."),
  title: z.string().trim().min(3, "Informe o titulo."),
  description: optionalText,
  service_type: z.enum(["georreferenciamento", "car", "itr_ccir", "outros_servicos"], {
    required_error: "Selecione o tipo de servico.",
  }),
  value: z.coerce.number().nonnegative().nullable().optional(),
  sent_at: dateString,
  valid_until: dateString,
  comments: optionalText,
});

export const proposalPdfSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente."),
  title: z.string().trim().min(3, "Informe o titulo."),
  value: z.coerce.number().nonnegative().nullable().optional(),
  valid_until: dateString,
  stage: z.enum(["todo", "sent", "negotiation", "execution", "finished", "lost"]),
  service_type: z.enum(["georreferenciamento", "car", "itr_ccir", "outros_servicos"]),
  comments: optionalText,
  file_path: z.string().min(1, "Envie o PDF da proposta."),
  file_name: z.string().min(1),
  mime_type: optionalText,
  size_bytes: z.coerce.number().nullable().optional(),
});

export const proposalModelDraftSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente."),
  title: z.string().trim().min(3, "Informe o titulo."),
  service_type: z.enum(["georreferenciamento", "car", "itr_ccir", "outros_servicos"]),
  demand: optionalText,
  sent_at: dateString,
  valid_until: dateString,
  value: z.coerce.number().nonnegative().nullable().optional(),
  sections: optionalText,
  model_name: optionalText,
});

export const serviceCardSchema = z.object({
  column_id: z.string().uuid("Selecione uma coluna."),
  client_id: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  title: z.string().trim().min(3, "Informe o titulo."),
  description: optionalText,
  service_type: z
    .enum(["georreferenciamento", "car", "itr_ccir", "outros_servicos"])
    .nullable()
    .optional(),
  payment_status: z
    .enum(["pagamento_nao_efetuado", "pagamento_efetuado"])
    .default("pagamento_nao_efetuado"),
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
    "profile",
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
  bucket: optionalText,
  storage_path: optionalText,
  file_name: z.string().min(1),
  mime_type: optionalText,
  size_bytes: z.coerce.number().nullable().optional(),
  file_size: z.coerce.number().nullable().optional(),
  category: optionalText,
});

export type ClientFormValues = z.input<typeof clientSchema>;
export type CompanySettingsFormValues = z.input<typeof companySettingsSchema>;
export type CompanyBankSettingsFormValues = z.input<typeof companyBankSettingsSchema>;
export type TeamMemberFormValues = z.input<typeof teamMemberSchema>;
export type ProfileFormValues = z.input<typeof profileSchema>;
export type CompanyServiceFormValues = z.input<typeof companyServiceSchema>;
export type PropertyMapFormValues = z.input<typeof propertyMapSchema>;
export type GeoQuerySearchFormValues = z.input<typeof geoQuerySearchSchema>;
export type ProposalFormValues = z.input<typeof proposalSchema>;
export type ProposalPdfFormValues = z.input<typeof proposalPdfSchema>;
export type ProposalModelDraftFormValues = z.input<typeof proposalModelDraftSchema>;
export type ServiceCardFormValues = z.input<typeof serviceCardSchema>;
export type FinanceFormValues = z.input<typeof financeSchema>;
