"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={signOut} title="Sair">
      <LogOut aria-hidden="true" />
      Sair
    </Button>
  );
}
