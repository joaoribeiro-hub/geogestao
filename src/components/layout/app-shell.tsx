import Link from "next/link";
import { headers } from "next/headers";
import {
  Archive,
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
  UserCircle,
  Users,
} from "lucide-react";
import { ptBR } from "@/lib/i18n/pt-br";
import { cn } from "@/lib/utils";
import { FloatingWidgets } from "@/components/floating/floating-widgets";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { WorkTimerTopbar } from "@/components/work-time/work-timer-topbar";

const mainNav = [
  { href: "/rotina", label: "Rotina", icon: CalendarRange },
  { href: "/inicio", label: "Inicio", icon: Home },
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
  { href: "/documentos", label: ptBR.nav.documents, icon: FileText },
  { href: "/legislacao", label: ptBR.nav.legislation, icon: BookOpen },
  { href: "/anexos", label: ptBR.nav.attachments, icon: Paperclip },
] as const;

export async function AppShell({
  children,
  userEmail,
  limitedMode = false,
  membershipRole = null,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
  limitedMode?: boolean;
  membershipRole?: string | null;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "/";
  const isOwner = membershipRole === "owner";
  const visibleMainNav = limitedMode
    ? []
    : mainNav.filter((item) => !("ownerOnly" in item) || !item.ownerOnly || isOwner);
  const visibleSettingsNav = limitedMode
    ? settingsNav.filter((item) => item.href === "/minha-conta")
    : settingsNav;
  const visibleMobileNav = limitedMode
    ? visibleSettingsNav
    : [...visibleMainNav, ...visibleSettingsNav].slice(0, 8);

  return (
    <div className="min-h-screen bg-background" data-testid="app-shell">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r bg-card lg:block">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Archive className="size-6 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{ptBR.appName}</p>
            <p className="text-xs text-muted-foreground">Agrimensura</p>
          </div>
        </div>
        <nav className="space-y-5 p-3">
          {!limitedMode ? (
            <NavSection label="MENU" pathname={pathname} items={visibleMainNav} />
          ) : (
            <div className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
              Conclua o cadastro da empresa para liberar o sistema.
            </div>
          )}
          <NavSection label="CONFIGURACOES" pathname={pathname} items={visibleSettingsNav} />
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:px-8">
          <div className="lg:hidden">
            <p className="text-sm font-semibold">{ptBR.appName}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {!limitedMode ? <WorkTimerTopbar /> : null}
            {!limitedMode ? <NotificationBell /> : null}
            <span
              className="hidden max-w-56 truncate text-sm text-muted-foreground sm:inline"
              data-testid="user-email"
            >
              {userEmail}
            </span>
            <SignOutButton />
          </div>
        </header>
        <main className="app-grid min-h-[calc(100vh-4rem)] p-4 pb-24 lg:p-8">{children}</main>
      </div>

      {!limitedMode ? <FloatingWidgets /> : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card p-2 lg:hidden">
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
  pathname,
  items,
}: {
  label: string;
  pathname: string;
  items: readonly NavItem[];
}) {
  return (
    <div data-testid={`nav-section-${label.toLowerCase()}`}>
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
