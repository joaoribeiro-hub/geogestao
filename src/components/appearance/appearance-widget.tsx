"use client";

import { useEffect, useState } from "react";
import { Check, Moon, Settings, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FontOption = {
  id: "padrao" | "grande" | "muito_grande" | "maximo";
  label: string;
};

const FONT_OPTIONS: FontOption[] = [
  { id: "padrao", label: "Padrao" },
  { id: "grande", label: "Grande" },
  { id: "muito_grande", label: "Muito grande" },
  { id: "maximo", label: "Maximo" },
];

const FONT_KEY = "geogestao:appearance-font-scale";
const LEGACY_FONT_KEY = "fontSize";
const THEME_KEY = "geogestao:appearance-theme";
const FONT_ALIASES: Record<string, FontOption["id"]> = {
  default: "padrao",
  large: "grande",
  xlarge: "muito_grande",
  max: "maximo",
  padrao: "padrao",
  grande: "grande",
  muito_grande: "muito_grande",
  maximo: "maximo",
};

export function AppearanceWidget() {
  const [open, setOpen] = useState(false);
  const [font, setFont] = useState<FontOption["id"]>("padrao");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedFont = window.localStorage.getItem(FONT_KEY) ?? window.localStorage.getItem(LEGACY_FONT_KEY);
    const storedTheme = window.localStorage.getItem(THEME_KEY) as "light" | "dark" | null;
    const nextFont = resolveFontSize(storedFont);
    const nextTheme = storedTheme === "dark" ? "dark" : "light";
    setFont(nextFont);
    setTheme(nextTheme);
    applyAppearance(nextFont, nextTheme);
  }, []);

  function updateFont(nextFont: FontOption["id"]) {
    setFont(nextFont);
    window.localStorage.setItem(FONT_KEY, nextFont);
    window.localStorage.setItem(LEGACY_FONT_KEY, nextFont);
    applyAppearance(nextFont, theme);
  }

  function updateTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
    applyAppearance(font, nextTheme);
  }

  return (
    <div className="relative flex flex-col items-end gap-2">
      {open ? (
        <section className="w-[min(92vw,320px)] rounded-lg border bg-card p-4 text-card-foreground shadow-xl" aria-label="Aparencia">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Aparencia</p>
              <p className="text-xs text-muted-foreground">Tema e tamanho da fonte.</p>
            </div>
            <Button type="button" size="icon" variant="ghost" aria-label="Fechar aparencia" onClick={() => setOpen(false)}>
              <X aria-hidden="true" />
            </Button>
          </header>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Tamanho da fonte</p>
              <div className="grid gap-2">
                {FONT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary",
                      font === option.id ? "border-primary bg-primary/10 text-primary" : "bg-background",
                    )}
                    onClick={() => updateFont(option.id)}
                  >
                    {option.label}
                    {font === option.id ? <Check className="size-4" aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Modo</p>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={theme === "light" ? "default" : "outline"} onClick={() => updateTheme("light")}>
                  <Sun aria-hidden="true" />
                  Claro
                </Button>
                <Button type="button" variant={theme === "dark" ? "default" : "outline"} onClick={() => updateTheme("dark")}>
                  <Moon aria-hidden="true" />
                  Escuro
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-11 rounded-full bg-card shadow-lg"
        aria-label={open ? "Fechar aparencia" : "Abrir aparencia"}
        onClick={() => setOpen((current) => !current)}
      >
        <Settings aria-hidden="true" />
      </Button>
    </div>
  );
}

function applyAppearance(font: FontOption["id"], theme: "light" | "dark") {
  document.documentElement.setAttribute("data-font-size", resolveFontSize(font));
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}

function resolveFontSize(value: string | null | undefined): FontOption["id"] {
  if (!value) return "padrao";
  return FONT_ALIASES[value] ?? "padrao";
}
