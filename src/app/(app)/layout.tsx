import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const pathname = (await headers()).get("x-pathname") ?? "/";
  const context = await getCurrentOrganizationContext(supabase, user.id);
  const needsOrganization = !context.organization || !context.membership;
  const allowedWithoutOrganization =
    pathname.startsWith("/onboarding") || pathname.startsWith("/minha-conta");

  if (needsOrganization && !allowedWithoutOrganization) {
    redirect("/onboarding");
  }

  return (
    <AppShell
      userEmail={user.email}
      limitedMode={needsOrganization}
      membershipRole={context.membership?.role ?? null}
    >
      {children}
    </AppShell>
  );
}
