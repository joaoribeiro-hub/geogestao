import { PageHeader } from "@/components/layout/page-header";
import { WorkersStatusPanel } from "@/components/system/workers-status-panel";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCurrentPlatformDeveloper } from "@/lib/platform/platform-auth";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function WorkersPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const platform = await getCurrentPlatformDeveloper(supabase, user);
  if (!platform.isPlatformDeveloper) redirect("/inicio");

  return (
    <div>
      <PageHeader title="Workers" description="Status dos serviços externos usados pelo GeoGestao. Segredos nunca são exibidos." />
      <WorkersStatusPanel />
    </div>
  );
}
