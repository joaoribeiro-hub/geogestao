"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock3, Loader2, MapPinned, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/services/work-time";

type WorkTimeStatus = {
  day: {
    status: "active" | "paused_interval" | "field_mode" | "safety_frozen" | "closed";
    total_work_seconds: number;
    total_interval_seconds: number;
    total_field_seconds: number;
  };
  workedSeconds: number;
  intervalSeconds: number;
  fieldSeconds: number;
  shouldPromptSafety: boolean;
  isFrozen: boolean;
  mode: "work" | "interval" | "field" | "frozen";
};

export function WorkTimerTopbar() {
  const [status, setStatus] = useState<WorkTimeStatus | null>(null);
  const [tick, setTick] = useState(0);
  const [pending, startTransition] = useTransition();

  async function load(method: "GET" | "POST" = "GET", action?: string) {
    const response = await fetch("/api/work-time", {
      method,
      cache: "no-store",
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify({ action }) : undefined,
    });
    if (!response.ok) return;
    setStatus((await response.json()) as WorkTimeStatus);
    setTick(0);
  }

  useEffect(() => {
    void load("POST", "heartbeat");
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") void load("POST", "heartbeat");
    }, 60000);
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load("POST", "heartbeat");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(heartbeat);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const displaySeconds = useMemo(() => {
    if (!status) return 0;
    if (status.mode === "work" || status.mode === "field") {
      return status.workedSeconds + tick;
    }
    return status.workedSeconds;
  }, [status, tick]);

  if (!status) {
    return (
      <div className="hidden items-center gap-2 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground sm:flex">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Expediente
      </div>
    );
  }

  const stateLabel =
    status.mode === "interval"
      ? "Intervalo"
      : status.mode === "field"
        ? "Campo"
        : status.isFrozen
          ? "Congelado"
          : "Trabalhando";

  function action(type: "toggle_interval" | "toggle_field" | "confirm_safety") {
    startTransition(() => {
      void load("POST", type);
    });
  }

  return (
    <div
      className={cn(
        "flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs shadow-sm",
        status.isFrozen && "border-destructive/40 bg-destructive/10 text-destructive",
        status.mode === "interval" && "border-amber-300 bg-amber-50 text-amber-800",
        status.mode === "field" && "border-emerald-300 bg-emerald-50 text-emerald-800",
        status.mode === "work" && !status.isFrozen && "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
      title={`Expediente: ${stateLabel}`}
    >
      <Clock3 className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-16 font-semibold tabular-nums">{formatDuration(displaySeconds)}</span>
      <span className="hidden text-[11px] sm:inline">{stateLabel}</span>
      {(status.shouldPromptSafety || status.isFrozen) && status.mode !== "interval" && status.mode !== "field" ? (
        <Button
          type="button"
          size="sm"
          variant={status.isFrozen ? "destructive" : "secondary"}
          className="h-7 px-2"
          onClick={() => action("confirm_safety")}
          disabled={pending}
        >
          <CheckCircle2 aria-hidden="true" />
          <span className="hidden sm:inline">Confirmar</span>
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2"
        onClick={() => action("toggle_interval")}
        disabled={pending || status.mode === "field"}
      >
        {status.mode === "interval" ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        <span className="hidden md:inline">{status.mode === "interval" ? "Voltar" : "Intervalo"}</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={status.mode === "field" ? "secondary" : "outline"}
        className="h-7 px-2"
        onClick={() => action("toggle_field")}
        disabled={pending || status.mode === "interval"}
      >
        <MapPinned aria-hidden="true" />
        <span className="hidden md:inline">Campo</span>
      </Button>
    </div>
  );
}
