import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SophiaLearningPanel } from "@/components/sophia/sophia-learning-panel";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function SophiaLearningPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization, membership } = await requireOrganization(supabase, user.id);
  if (!organization || membership?.role !== "owner") redirect("/inicio");
  return <div><PageHeader title="Aprendizados da Sophia" description="Revise reflexoes e aprove regras operacionais antes que entrem na memoria da empresa." /><SophiaLearningPanel /></div>;
}

