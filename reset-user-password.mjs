import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.SUPABASE_USER_ID;
const newPassword = process.env.SUPABASE_NEW_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !userId || !newPassword) {
  console.error("Faltam variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_USER_ID, SUPABASE_NEW_PASSWORD");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  password: newPassword,
});

if (error) {
  console.error("Erro ao atualizar senha:", error.message);
  process.exit(1);
}

console.log("Senha atualizada com sucesso para:", data.user.email);