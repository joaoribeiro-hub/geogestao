"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SophiaSidePanel({
  open,
  onClose,
  children,
  footer,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  initialFocusRef?: RefObject<HTMLInputElement | null>;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => initialFocusRef?.current?.focus(), 220);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [initialFocusRef, onClose, open]);

  return (
    <>
      <button
        type="button"
        className={cn("sophia-panel-overlay", open && "is-open")}
        aria-label="Fechar painel da Sophia"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <section
        ref={panelRef}
        className="sophia-side-panel"
        data-open={open}
        data-testid="assistant-floating-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sophia-panel-title"
        aria-hidden={!open}
      >
        <header className="flex min-h-20 items-center justify-between gap-4 border-b px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Bot className="size-6" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 id="sophia-panel-title" className="text-lg font-semibold">Sophia</h2>
              <p className="truncate text-sm text-muted-foreground">Assistente operacional do GeoGestao</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Fechar Sophia" title="Fechar Sophia" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <footer className="border-t bg-background p-4">{footer}</footer>
      </section>
    </>
  );
}
