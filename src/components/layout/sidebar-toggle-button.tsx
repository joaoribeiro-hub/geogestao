"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "geogestao:sidebar-collapsed";

export function SidebarToggleButton() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_KEY) === "true";
    setCollapsed(stored);
    document.documentElement.dataset.sidebarCollapsed = stored ? "true" : "false";
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(SIDEBAR_KEY, String(next));
    document.documentElement.dataset.sidebarCollapsed = next ? "true" : "false";
  }

  return (
    <button
      type="button"
      className={cn(
        "fixed top-1/2 z-30 hidden size-9 -translate-y-1/2 place-items-center rounded-full border bg-card text-muted-foreground shadow-lg transition-all hover:text-foreground lg:grid",
        collapsed ? "left-3" : "left-[15.25rem]",
      )}
      aria-label={collapsed ? "Abrir menu lateral" : "Recolher menu lateral"}
      onClick={toggle}
    >
      {collapsed ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronLeft className="size-4" aria-hidden="true" />}
    </button>
  );
}
