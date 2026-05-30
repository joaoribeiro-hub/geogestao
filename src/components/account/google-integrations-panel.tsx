"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Cloud, Loader2, Plug, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type IntegrationStatus = {
  provider: "google_drive" | "google_calendar";
  email: string | null;
  status: string;
};

export function GoogleIntegrationsPanel() {
  const [items, setItems] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [configurationMessage, setConfigurationMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/integrations/google/status", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as { integrations?: IntegrationStatus[] } | null;
    setItems(data?.integrations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "not_configured") {
      setConfigurationMessage(
        "Google ainda nao foi configurado no servidor. Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI e GOOGLE_TOKEN_ENCRYPTION_KEY no ambiente do projeto.",
      );
    }
  }, []);

  async function disconnect(provider: IntegrationStatus["provider"]) {
    setDisconnecting(provider);
    await fetch("/api/integrations/google/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    setDisconnecting(null);
    await load();
  }

  const drive = items.find((item) => item.provider === "google_drive");
  const calendar = items.find((item) => item.provider === "google_calendar");

  return (
    <div className="grid gap-3 text-sm">
      {configurationMessage ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
          {configurationMessage}
        </div>
      ) : null}
      <IntegrationRow
        icon={<Cloud aria-hidden="true" />}
        title="Google Drive"
        description="Salvar documentos no seu Drive conectado."
        provider="google_drive"
        item={drive}
        loading={loading}
        disconnecting={disconnecting === "google_drive"}
        onDisconnect={disconnect}
      />
      <IntegrationRow
        icon={<CalendarDays aria-hidden="true" />}
        title="Google Calendar"
        description="Sincronizar lembretes selecionados com sua agenda."
        provider="google_calendar"
        item={calendar}
        loading={loading}
        disconnecting={disconnecting === "google_calendar"}
        onDisconnect={disconnect}
      />
    </div>
  );
}

function IntegrationRow({
  icon,
  title,
  description,
  provider,
  item,
  loading,
  disconnecting,
  onDisconnect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  provider: IntegrationStatus["provider"];
  item?: IntegrationStatus;
  loading: boolean;
  disconnecting: boolean;
  onDisconnect: (provider: IntegrationStatus["provider"]) => void;
}) {
  const connected = item?.status === "active";
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary [&_svg]:size-4">{icon}</div>
          <div className="min-w-0">
            <p className="font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
            {connected ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{item?.email ?? "Conta Google conectada"}</p>
            ) : null}
          </div>
        </div>
        <Badge variant={connected ? "secondary" : "outline"}>{connected ? "Conectado" : "Desconectado"}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {loading ? (
          <Button type="button" size="sm" variant="outline" disabled>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Verificando
          </Button>
        ) : connected ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onDisconnect(provider)} disabled={disconnecting}>
            {disconnecting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Unplug aria-hidden="true" />}
            Desconectar
          </Button>
        ) : (
          <Button asChild size="sm">
            <a href={`/api/integrations/google/connect?provider=${provider}`}>
              <Plug aria-hidden="true" />
              Conectar
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
