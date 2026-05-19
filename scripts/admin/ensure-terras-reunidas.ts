import { createClient } from "@supabase/supabase-js";

async function main() {
  const ownerEmail = process.argv
    .find((arg) => arg.startsWith("--owner-email="))
    ?.split("=")[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: existing } = await supabase
    .from("organizations")
    .select("id,name,slug")
    .eq("slug", "terras-reunidas")
    .maybeSingle();

  let organizationId = existing?.id;

  if (!organizationId) {
    const { data: plan } = await supabase
      .from("plans")
      .select("id,storage_quota_mb")
      .eq("slug", "gratuito")
      .maybeSingle();

    const { data, error } = await supabase
      .from("organizations")
      .insert({
        name: "Terras Reunidas",
        trade_name: "Terras Reunidas",
        slug: "terras-reunidas",
        plan_id: plan?.id ?? null,
        storage_quota_mb: plan?.storage_quota_mb ?? 1024,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    organizationId = data.id;
  }

  console.log(`Organizacao pronta: Terras Reunidas (${organizationId})`);

  if (ownerEmail) {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw new Error(usersError.message);
    const owner = users.users.find((user) => user.email === ownerEmail);
    if (!owner) throw new Error(`Usuario nao encontrado no Auth: ${ownerEmail}`);

    const [{ error: profileError }, { error: memberError }, { error: orgError }] =
      await Promise.all([
        supabase.from("profiles").update({ organization_id: organizationId }).eq("id", owner.id),
        supabase.from("organization_members").upsert(
          {
            organization_id: organizationId,
            user_id: owner.id,
            role: "owner",
            status: "active",
          },
          { onConflict: "organization_id,user_id" },
        ),
        supabase
          .from("organizations")
          .update({ owner_user_id: owner.id })
          .eq("id", organizationId),
      ]);
    if (profileError) throw new Error(profileError.message);
    if (memberError) throw new Error(memberError.message);
    if (orgError) throw new Error(orgError.message);
    console.log(`Owner vinculado: ${ownerEmail}`);
  } else {
    console.log("Passe --owner-email=voce@empresa.com para vincular um usuario owner.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
