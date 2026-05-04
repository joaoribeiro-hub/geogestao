import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
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

  return <AppShell userEmail={user.email}>{children}</AppShell>;
}
