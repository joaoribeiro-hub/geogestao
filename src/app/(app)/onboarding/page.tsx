import { redirect } from "next/navigation";
import { OrganizationOnboarding } from "@/components/onboarding/organization-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const context = await getCurrentOrganizationContext(supabase, user.id);

  if (context.organization && context.membership) {
    redirect("/inicio");
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6" data-testid="onboarding-page">
      <Card>
        <CardHeader>
          <CardTitle>Concluir cadastro da empresa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sua conta foi criada. Para liberar o GeoGestao, participe de uma empresa existente
            ou cadastre uma nova organizacao.
          </p>
        </CardHeader>
        <CardContent>
          <OrganizationOnboarding />
        </CardContent>
      </Card>
    </div>
  );
}
