import Link from "next/link";
import { headers } from "next/headers";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CalendarRange,
  FileText,
  Home,
  Landmark,
  Paperclip,
  Wrench,
  UserCircle,
  Users,
  ServerCog,
  BrainCircuit,
  FlaskConical,
} from "lucide-react";
import { ptBR } from "@/lib/i18n/pt-br";
import { cn } from "@/lib/utils";
import { FloatingWidgets } from "@/components/floating/floating-widgets";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SidebarToggleButton } from "@/components/layout/sidebar-toggle-button";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { LightweightModeToggle } from "@/components/layout/lightweight-mode-toggle";
import { BrandLogoSlot } from "@/components/layout/brand-logo-slot";
import { createServerSupabase } from "@/lib/supabase/server";
import { WorkTimerTopbar } from "@/components/work-time/work-timer-topbar";
import { OperationalProfileSwitcher } from "@/components/layout/operational-profile-switcher";
import { CommandMenu } from "@/components/layout/command-menu";
import type { OperationalProfile } from "@/lib/operational-profile";

const mainNav = [
  { href: "/rotina", label: "Rotina", icon: CalendarRange },
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/ferramentas", label: "Ferramentas", icon: Wrench },
  { href: "/servicos", label: ptBR.nav.services, icon: BriefcaseBusiness },
  { href: "/propostas", label: "Propostas", icon: FileText, nested: true },
  { href: "/contratos", label: "Contratos", icon: FileText, nested: true },
  { href: "/clientes", label: ptBR.nav.clients, icon: Users },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/financeiro", label: ptBR.nav.finance, icon: Landmark, ownerOnly: true },
  { href: "/relatorios", label: "Relatorios", icon: BarChart3 },
] as const;

const settingsNav = [
  { href: "/minha-empresa", label: ptBR.nav.company, icon: Building2 },
  { href: "/minha-conta", label: "Minha Conta", icon: UserCircle },
  { href: "/sistema/workers", label: "Workers", icon: ServerCog, adminOnly: true },
  { href: "/documentos", label: ptBR.nav.documents, icon: FileText },
  { href: "/legislacao", label: ptBR.nav.legislation, icon: BookOpen },
  { href: "/anexos", label: ptBR.nav.attachments, icon: Paperclip },
  { href: "/sophia/aprendizados", label: "Aprendizados Sophia", icon: BrainCircuit, ownerOnly: true },
  { href: "/sophia/evals", label: "Avaliacoes Sophia", icon: FlaskConical, adminOnly: true },
] as const;

export async function AppShell({
  children,
  userEmail,
  userName,
  userId,
  limitedMode = false,
  membershipRole = null,
  operationalProfile = "agrimensura",
}: {
  children: React.ReactNode;
  userEmail?: string | null;
  userName?: string | null;
  userId?: string | null;
  limitedMode?: boolean;
  membershipRole?: string | null;
  operationalProfile?: OperationalProfile;
  organizationId?: string | null;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "/";
  const isOwner = membershipRole === "owner";
  const shellSupabase = userId ? await createServerSupabase() : null;
  let preferenceResult: { data: { lightweight_mode?: boolean | null } | null } = { data: null };
  if (userId && shellSupabase) {
    try {
      preferenceResult = await (shellSupabase as unknown as {
        from(table: string): {
          select(columns: string): {
            eq(column: string, value: string): {
              maybeSingle(): Promise<{ data: { lightweight_mode?: boolean | null } | null }>;
            };
          };
        };
      })
        .from("user_preferences")
        .select("lightweight_mode")
        .eq("user_id", userId)
        .maybeSingle();
    } catch {
      // A migration ausente nao deve impedir o carregamento do app.
      preferenceResult = { data: null };
    }
  }
  const lightweightMode = preferenceResult.data?.lightweight_mode === true;
  const timeTrackingEnabled = process.env.NEXT_PUBLIC_TIME_TRACKING_ENABLED === "true";
  const visibleMainNav = limitedMode
    ? []
    : mainNav.filter((item) => !("ownerOnly" in item) || !item.ownerOnly || isOwner);
  const visibleSettingsNav = limitedMode
    ? settingsNav.filter((item) => item.href === "/minha-conta")
    : settingsNav
        .filter((item) => !("ownerOnly" in item) || !item.ownerOnly || isOwner)
        .filter((item) => !("adminOnly" in item) || !item.adminOnly || isOwner || membershipRole === "admin");
  const lightweightMobileMain = visibleMainNav.filter((item) =>
    ["/inicio", "/ferramentas", "/servicos", "/agenda"].includes(item.href),
  );
  const visibleMobileNav = limitedMode
    ? visibleSettingsNav
    : lightweightMode
      ? [...lightweightMobileMain, ...visibleSettingsNav].slice(0, 8)
      : [...visibleMainNav, ...visibleSettingsNav].slice(0, 8);

  return (
    <div className="min-h-screen bg-background" data-testid="app-shell" data-lightweight={lightweightMode}>
      <aside className="app-sidebar fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center border-b px-4">
          {/* href="/inicio" | Agrimensura / Arquitetura / Engenharia: fallback preservado pelo BrandLogoSlot. */}
          <BrandLogoSlot />
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3">
          {!limitedMode ? (
            <NavSection label="MENU" group="main" pathname={pathname} items={visibleMainNav} />
          ) : (
            <div className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
              Conclua o cadastro da empresa para liberar o sistema.
            </div>
          )}
          <div className="mt-auto space-y-3 pt-6">
            {!limitedMode ? <OperationalProfileSwitcher initialProfile={operationalProfile ?? "agrimensura"} canEdit={isOwner} /> : null}
            <NavSection label="CONFIGURACOES" group="settings" pathname={pathname} items={visibleSettingsNav} />
          </div>
        </nav>
      </aside>
      <SidebarToggleButton />

      <div className="app-content lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:px-8">
          <div className="lg:hidden">
            <p className="text-sm font-semibold">{ptBR.appName}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {!limitedMode ? <CommandMenu /> : null}
            {!limitedMode ? <LightweightModeToggle initialEnabled={lightweightMode} /> : null}
            {timeTrackingEnabled && !limitedMode ? <WorkTimerTopbar /> : null}
            {!limitedMode ? <NotificationBell /> : null}
            <UserAccountMenu name={userName} email={userEmail} />
          </div>
        </header>
        <main className="app-grid min-h-[calc(100vh-4rem)] p-4 pb-24 lg:p-8">{children}</main>
      </div>

      {!limitedMode ? <FloatingWidgets /> : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card p-2 lg:hidden" data-nav-group="mobile">
        {visibleMobileNav.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium text-muted-foreground",
                active && "bg-secondary text-foreground",
              )}
              data-nav-key={item.href.slice(1).replaceAll("/", "-")}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

type NavItem = (typeof mainNav)[number] | (typeof settingsNav)[number];

function NavSection({
  label,
  group,
  pathname,
  items,
}: {
  label: string;
  group: "main" | "settings";
  pathname: string;
  items: readonly NavItem[];
}) {
  return (
    <div data-testid={`nav-section-${label.toLowerCase()}`} data-nav-group={group}>
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                "nested" in item && item.nested && "ml-7 py-1.5 text-xs",
                active && "bg-secondary text-foreground",
              )}
              data-nav-key={item.href.slice(1).replaceAll("/", "-")}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
