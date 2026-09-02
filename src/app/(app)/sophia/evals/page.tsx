import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SophiaEvalsPanel } from "@/components/sophia/sophia-evals-panel";
import { requireUser } from "@/lib/auth";
import { getCurrentPlatformDeveloper } from "@/lib/platform/platform-auth";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function SophiaEvalsPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const platform = await getCurrentPlatformDeveloper(supabase, user);
  if (!platform.isPlatformDeveloper) redirect("/inicio");
  return <div><PageHeader title="Avaliacoes da Sophia" description="Execute casos de regressao para conferir tools, permissoes e respostas locais." /><SophiaEvalsPanel /></div>;
}
