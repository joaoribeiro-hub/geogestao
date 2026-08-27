import { PageHeader } from "@/components/layout/page-header";
import { WorkersStatusPanel } from "@/components/system/workers-status-panel";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function WorkersPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await getCurrentOrganizationContext(supabase, user.id);
  if (!organization || !membership || !["owner", "admin"].includes(membership.role)) redirect("/inicio");

  return (
    <div>
      <PageHeader title="Workers" description="Status dos serviços externos usados pelo GeoGestao. Segredos nunca são exibidos." />
      <WorkersStatusPanel />
    </div>
  );
}
