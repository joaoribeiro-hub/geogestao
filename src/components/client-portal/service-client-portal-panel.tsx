"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ServiceClientPortalPanel({
  serviceCardId,
  hasPortal,
  lastPublishedAt,
  canEdit,
}: {
  serviceCardId: string;
  hasPortal: boolean;
  lastPublishedAt?: string | null;
  canEdit: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publishPortal() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const response = await fetch(`/api/client-portals/service/${serviceCardId}`, {
        method: "POST",
      });
      const data = (await response.json()) as { publicUrl?: string; error?: string };
      if (!response.ok || !data.publicUrl) {
        throw new Error(data.error || "Não foi possível publicar o portal.");
      }
      setPublicUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível publicar o portal.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal do Cliente</CardTitle>
        <CardDescription>
          Publique um acompanhamento limpo para o cliente com progresso, etapas e atualizações permitidas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-md bg-secondary p-3 text-muted-foreground">
          {hasPortal ? (
            <p>
              Portal já preparado para este serviço
              {lastPublishedAt ? ` · última publicação em ${new Date(lastPublishedAt).toLocaleString("pt-BR")}` : "."}
            </p>
          ) : (
            <p>Este serviço ainda não possui portal publicado.</p>
          )}
        </div>

        {publicUrl ? (
          <div className="space-y-2 rounded-md border bg-background p-3">
            <p className="font-medium">Link criado agora</p>
            <p className="break-all text-xs text-muted-foreground">{publicUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={copyLink} variant="outline">
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? "Copiado" : "Copiar link"}
              </Button>
              <Button type="button" size="sm" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" />
                  Abrir portal
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Por segurança, o token original não fica gravado no banco. Copie o link agora.
            </p>
          </div>
        ) : null}

        {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

        {canEdit ? (
          <Button type="button" onClick={publishPortal} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {hasPortal ? "Gerar novo link" : "Publicar portal"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Apenas quem pode editar o serviço pode publicar ou gerar novo link do portal.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
