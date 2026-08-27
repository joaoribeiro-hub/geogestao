import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SophiaEvalsPanel } from "@/components/sophia/sophia-evals-panel";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function SophiaEvalsPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization || !membership || !["owner", "admin"].includes(membership.role)) redirect("/inicio");
  return <div><PageHeader title="Avaliacoes da Sophia" description="Execute casos de regressao para conferir tools, permissoes e respostas locais." /><SophiaEvalsPanel /></div>;
}
