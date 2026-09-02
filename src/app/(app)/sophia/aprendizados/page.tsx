import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SophiaLearningPanel } from "@/components/sophia/sophia-learning-panel";
import { requireUser } from "@/lib/auth";
import { getCurrentPlatformDeveloper } from "@/lib/platform/platform-auth";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function SophiaLearningPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const platform = await getCurrentPlatformDeveloper(supabase, user);
  if (!platform.isPlatformDeveloper) redirect("/inicio");
  return <div><PageHeader title="Aprendizados universais da Sophia" description="Revise somente regras abstratas e sanitizadas antes de publica-las para toda a plataforma." /><SophiaLearningPanel /></div>;
}
