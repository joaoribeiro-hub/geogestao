import { PageHeader } from "@/components/layout/page-header";
import { ToolsHub } from "@/components/tools/tools-hub";
import { getMoreTools, getMyTools } from "@/lib/tools/tool-access";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { normalizeOperationalProfile } from "@/lib/operational-profile";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function FerramentasPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);
  const profile = normalizeOperationalProfile(context.organization?.operational_profile);
  return (
    <div>
      <PageHeader
        title="Ferramentas"
        description="Ative módulos técnicos e extensões do GeoGestão."
      />
      <ToolsHub profile={profile} myTools={getMyTools(profile)} moreTools={getMoreTools(profile)} />
    </div>
  );
}
