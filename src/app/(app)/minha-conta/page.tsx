import { Save } from "lucide-react";
import { updateProfileAction } from "@/app/(app)/minha-conta/actions";
import { AvatarUploader } from "@/components/account/avatar-uploader";
import { PlansModal } from "@/components/account/plans-modal";
import { PageHeader } from "@/components/layout/page-header";
import { OrganizationOnboarding } from "@/components/onboarding/organization-onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { calculateStorageUsage, mbToBytes } from "@/lib/services/storage-quota";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type PreferenceMap = Record<string, boolean>;

export default async function AccountPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { profile, organization, membership } = await getCurrentOrganizationContext(supabase, user.id);

  const { data: attachments } = organization
    ? await supabase
        .from("attachments")
        .select("file_size,size_bytes")
        .eq("organization_id", organization.id)
    : { data: [] };
  const usedBytes = calculateStorageUsage(attachments ?? []);

  const avatarUrl = organization && profile.avatar_path
    ? (
        await supabase.storage
          .from("attachments")
          .createSignedUrl(profile.avatar_path, 60 * 60)
      ).data?.signedUrl ?? null
    : null;
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .eq("is_public", true)
    .order("price_monthly_cents", { ascending: true });

  const emailPreferences = asPreferenceMap(profile.email_preferences);
  const accountPreferences = asPreferenceMap(profile.account_preferences);

  return (
    <div data-testid="account-page">
      <PageHeader
        title="Minha Conta"
        description="Dados pessoais, foto de perfil e preferencias da sua conta."
        titleTestId="account-title"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateProfileAction} className="grid gap-5" data-testid="account-profile-form">
              {organization ? (
                <AvatarUploader currentUrl={avatarUrl} currentPath={profile.avatar_path} />
              ) : (
                <div className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
                  A foto de perfil fica disponivel depois que voce entrar ou criar uma empresa.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome completo">
                  <Input
                    name="full_name"
                    defaultValue={profile.full_name ?? ""}
                    required
                    minLength={2}
                    data-testid="account-full-name"
                  />
                </Field>
                <Field label="Telefone">
                  <Input name="phone" defaultValue={profile.phone ?? ""} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Data de nascimento">
                  <Input
                    name="birth_date"
                    type="date"
                    defaultValue={profile.birth_date ?? ""}
                  />
                </Field>
                <Field label="Tipo de documento">
                  <select
                    name="document_type"
                    defaultValue={profile.document_type ?? ""}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Nao informado</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="rg">RG</option>
                    <option value="outro">Outro</option>
                  </select>
                </Field>
                <Field label="Numero do documento">
                  <Input name="document_number" defaultValue={profile.document_number ?? ""} />
                </Field>
              </div>

              <Field label="E-mail de login">
                <Input value={user.email ?? ""} readOnly data-testid="account-email" />
              </Field>

              <section className="grid gap-3 rounded-md border p-4">
                <div>
                  <p className="font-medium">Preferencias de e-mail</p>
                  <p className="text-sm text-muted-foreground">
                    Escolha quais tipos de comunicacao ficarao habilitados na conta.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CheckboxField
                    name="email_summaries"
                    label="Resumos"
                    defaultChecked={emailPreferences.summaries ?? true}
                  />
                  <CheckboxField
                    name="email_special_dates"
                    label="Datas comemorativas"
                    defaultChecked={emailPreferences.special_dates ?? false}
                  />
                  <CheckboxField
                    name="email_projects"
                    label="Projetos"
                    defaultChecked={emailPreferences.projects ?? true}
                  />
                  <CheckboxField
                    name="email_proposals"
                    label="Propostas"
                    defaultChecked={emailPreferences.proposals ?? true}
                  />
                  <CheckboxField
                    name="email_finance"
                    label="Financeiro"
                    defaultChecked={emailPreferences.finance ?? true}
                  />
                </div>
              </section>

              <section className="grid gap-3 rounded-md border p-4">
                <p className="font-medium">Preferencias da conta</p>
                <CheckboxField
                  name="compact_mode"
                  label="Modo compacto"
                  defaultChecked={accountPreferences.compact_mode ?? false}
                />
              </section>

              <Button className="w-fit" type="submit" data-testid="account-submit">
                <Save aria-hidden="true" />
                Salvar conta
              </Button>
            </form>
          </CardContent>
        </Card>

        <aside className="grid gap-6 content-start">
          <Card>
            <CardHeader>
              <CardTitle>Organizacao</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {organization && membership ? (
                <>
                  <div>
                    <p className="text-muted-foreground">Empresa</p>
                    <p className="font-medium">{organization.trade_name ?? organization.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Seu papel</p>
                    <Badge variant="secondary">
                      {membership.role === "owner" ? "Proprietario" : "Admin operacional"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Plano atual</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {organization.plan?.name ?? "Plano nao definido"}
                      </Badge>
                      <span className="text-muted-foreground">
                        {organization.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Armazenamento</p>
                    <p className="font-medium">
                      {formatBytes(usedBytes)} de {formatBytes(mbToBytes(organization.storage_quota_mb))}
                    </p>
                  </div>
                  <PlansModal plans={plans ?? []} currentPlanId={organization.plan_id} />
                </>
              ) : (
                <div className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
                  Sua conta ainda nao participa de uma empresa. Conclua o onboarding para liberar o sistema.
                </div>
              )}
            </CardContent>
          </Card>
          {!organization || !membership ? <OrganizationOnboarding /> : null}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-input"
      />
      {label}
    </label>
  );
}

function asPreferenceMap(value: Json | undefined): PreferenceMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce<PreferenceMap>((acc, [key, item]) => {
    if (typeof item === "boolean") acc[key] = item;
    return acc;
  }, {});
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
