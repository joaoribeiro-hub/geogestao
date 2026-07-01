"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Archive, Check, ChevronDown } from "lucide-react";
import { APP_MODULES, getModuleByRoute, getModuleStatusLabel } from "@/lib/modules/app-modules";
import { cn } from "@/lib/utils";

export function ModuleSwitcher() {
  const pathname = usePathname() ?? "/";
  const currentModule = getModuleByRoute(pathname);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition hover:bg-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Archive className="size-6 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{currentModule.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {currentModule.key === "geogestao" ? "Agrimensura" : getModuleStatusLabel(currentModule.status)}
          </span>
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 rounded-lg border bg-card p-2 text-card-foreground shadow-xl"
        >
          <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
            Modulos
          </p>
          <div className="grid gap-1">
            {APP_MODULES.map((module) => {
              const active = currentModule.key === module.key;
              return (
                <Link
                  key={module.key}
                  href={module.route}
                  role="menuitem"
                  className={cn(
                    "flex items-start gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-secondary",
                    active && "bg-secondary text-foreground",
                  )}
                  onClick={() => setOpen(false)}
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border">
                    {active ? <Check className="size-3 text-primary" aria-hidden="true" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{module.name}</span>
                    <span className="block line-clamp-2 text-xs text-muted-foreground">{module.description}</span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      module.status === "ativo" && "bg-emerald-100 text-emerald-700",
                      module.status === "beta" && "bg-blue-100 text-blue-700",
                      module.status === "worker_pendente" && "bg-orange-100 text-orange-800",
                      module.status === "em_migracao" && "bg-amber-100 text-amber-800",
                      module.status === "indisponivel" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {getModuleStatusLabel(module.status)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
