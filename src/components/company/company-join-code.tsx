"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CompanyJoinCode({ code }: { code: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setMessage("Codigo copiado.");
  }

  return (
    <div className="rounded-md border bg-secondary/50 p-4" data-testid="company-join-code">
      <p className="text-sm font-medium">ID da empresa</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Compartilhe este codigo somente com usuarios que devem entrar nesta empresa.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded-md border bg-background px-3 py-2 text-sm font-semibold tracking-normal">
          {code}
        </code>
        <Button type="button" variant="outline" onClick={copy}>
          <Copy aria-hidden="true" />
          Copiar
        </Button>
      </div>
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
