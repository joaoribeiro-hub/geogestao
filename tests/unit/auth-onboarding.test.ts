import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatCpf,
  isStrongEnoughPassword,
  isValidCpf,
  resetPasswordSchema,
  signUpSchema,
} from "@/lib/auth-validation";
import {
  canJoinOrganization,
  canUploadFile,
  getOrganizationPlanLimits,
  summarizePlanUsage,
} from "@/lib/services/organization-plans";

describe("AUTH-ORG-PLANS-1 auth validation", () => {
  it("valida CPF, senha e confirmacao de cadastro", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isStrongEnoughPassword("geogestao1")).toBe(true);
    expect(isStrongEnoughPassword("geogestao")).toBe(false);

    const parsed = signUpSchema.safeParse({
      fullName: "Flavio Terras",
      email: "flavio.terras@example.com",
      cpf: "529.982.247-25",
      birthDate: "1990-05-20",
      password: "terras2026",
      confirmPassword: "terras2026",
    });

    expect(parsed.success).toBe(true);
    expect(
      signUpSchema.safeParse({
        fullName: "Flavio Terras",
        email: "flavio.terras@example.com",
        cpf: "529.982.247-25",
        birthDate: "1990-05-20",
        password: "terras2026",
        confirmPassword: "outra2026",
      }).success,
    ).toBe(false);
  });

  it("valida nova senha do fluxo de recuperacao", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "novaSenha1",
        confirmPassword: "novaSenha1",
      }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        password: "curta1",
        confirmPassword: "curta1",
      }).success,
    ).toBe(false);
  });
});

describe("AUTH-ORG-PLANS-1 plan limits", () => {
  it("mantem plano Iniciante com limite de 3 usuarios", () => {
    const limits = getOrganizationPlanLimits(null);
    expect(limits.maxUsers).toBe(3);
    expect(canJoinOrganization({ maxUsers: limits.maxUsers, usersCount: 2 })).toBe(true);
    expect(canJoinOrganization({ maxUsers: limits.maxUsers, usersCount: 3 })).toBe(false);
    expect(canUploadFile({ storageLimitMb: 3072, storageUsedMb: 100, incomingMb: 5 })).toBe(true);

    expect(
      summarizePlanUsage({
        limits,
        usage: { usersCount: 3, storageUsedMb: 10, servicesCount: 1, documentsCount: 1 },
      }).users.canAdd,
    ).toBe(false);
  });
});

describe("AUTH-ORG-PLANS-1 migration", () => {
  it("cria onboarding sem empresa, join code seguro e reset generico", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/023_auth_org_plans_onboarding.sql"),
      "utf8",
    );

    expect(migration).toContain("pending_organization");
    expect(migration).toContain("organization_join_codes");
    expect(migration).toContain("generate_organization_join_code");
    expect(migration).toContain("create_organization_for_current_user");
    expect(migration).toContain("join_organization_by_code");
    expect(migration).toContain("can_request_password_reset");
    expect(migration).toContain("max_users");
    expect(migration).toContain("Esta empresa atingiu o limite de usuarios do plano atual.");
    expect(migration).toContain("organization_id, user_id, role, status");
    expect(migration).toContain("'admin', 'active'");
    expect(migration).toContain("organizations_update_owner");
    expect(migration).not.toContain("service_role");
  });

  it("gera codigo da empresa sem depender de gen_random_bytes", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/025_onboarding_join_code_uuid_fix.sql"),
      "utf8",
    );

    expect(migration).toContain("generate_organization_join_code");
    expect(migration).toContain("gen_random_uuid()");
    expect(migration).not.toContain("gen_random_bytes");
  });

  it("mantem handle_new_user criando profile sem organizacao", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/023_auth_org_plans_onboarding.sql"),
      "utf8",
    );

    const handleNewUserBody = migration.slice(
      migration.indexOf("create or replace function public.handle_new_user()"),
      migration.indexOf("alter table public.organization_join_codes enable row level security"),
    );

    expect(handleNewUserBody).toContain("organization_id");
    expect(handleNewUserBody).toContain("null,");
    expect(handleNewUserBody).toContain("'pending_organization'");
    expect(handleNewUserBody).not.toContain("insert into public.organizations");
    expect(handleNewUserBody).not.toContain("insert into public.organization_members");
  });

  it("corrige criacao de empresa no onboarding com constraint multiempresa em company_settings", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/024_onboarding_company_creation_debug_fix.sql"),
      "utf8",
    );

    expect(migration).toContain("drop constraint if exists company_settings_singleton_key_key");
    expect(migration).toContain("company_settings_organization_singleton_key_idx");
    expect(migration).toContain("upsert_company_settings");
    expect(migration).toContain("insert into public.organizations");
    expect(migration).toContain("insert into public.organization_members");
    expect(migration).toContain("update public.profiles");
    expect(migration).toContain("Falha no cadastro da empresa na etapa");
  });

  it("evita referencia ambigua de organization_id no insert de company_settings", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/026_onboarding_company_settings_conflict_fix.sql"),
      "utf8",
    );

    expect(migration).toContain("v_step := 'insert_company_settings'");
    expect(migration).toContain("insert into public.company_settings");
    expect(migration).not.toContain("on conflict (organization_id, singleton_key)");
  });
});
