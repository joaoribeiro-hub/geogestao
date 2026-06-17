"use client";

import { useEffect, useState } from "react";
import { Check, Minus, Moon, Plus, Settings, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaletteOption = {
  id: "agrimensura_verde" | "azul_tecnico" | "cerrado_terra" | "grafite_profissional" | "noite_atlantica";
  label: string;
};

const PALETTE_OPTIONS: PaletteOption[] = [
  { id: "agrimensura_verde", label: "Agrimensura Verde" },
  { id: "azul_tecnico", label: "Azul Tecnico" },
  { id: "cerrado_terra", label: "Cerrado Terra" },
  { id: "grafite_profissional", label: "Grafite Profissional" },
  { id: "noite_atlantica", label: "Noite Atlantica" },
];

const FONT_KEY = "geogestao:appearance-font-scale";
const LEGACY_FONT_KEY = "fontSize";
const THEME_KEY = "geogestao:appearance-theme";
const PALETTE_KEY = "geogestao:appearance-palette";
const MIN_FONT_SCALE = 0.6;
const DEFAULT_FONT_SCALE = 1;
const MAX_FONT_SCALE = 1.75;
const FONT_SCALE_STEP = 0.05;

export function AppearanceWidget() {
  const [open, setOpen] = useState(false);
  const [fontScale, setFontScale] = useState(DEFAULT_FONT_SCALE);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [palette, setPalette] = useState<PaletteOption["id"]>("agrimensura_verde");

  useEffect(() => {
    const storedFont = window.localStorage.getItem(FONT_KEY) ?? window.localStorage.getItem(LEGACY_FONT_KEY);
    const storedTheme = window.localStorage.getItem(THEME_KEY) as "light" | "dark" | null;
    const storedPalette = resolvePalette(window.localStorage.getItem(PALETTE_KEY));
    const nextFontScale = resolveFontScale(storedFont);
    const nextTheme = storedTheme === "dark" ? "dark" : "light";
    setFontScale(nextFontScale);
    setTheme(nextTheme);
    setPalette(storedPalette);
    applyAppearance(nextFontScale, nextTheme, storedPalette);
    void loadServerPreferences();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void saveServerPreferences({ fontScale, theme, palette });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [fontScale, theme, palette]);

  async function loadServerPreferences() {
    const response = await fetch("/api/ui-preferences", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const data = (await response.json().catch(() => null)) as {
      fontScale?: string | number | null;
      theme?: "light" | "dark" | null;
      palette?: string | null;
    } | null;
    if (!data) return;
    const nextFontScale = resolveFontScale(data.fontScale);
    const nextTheme = data.theme === "dark" ? "dark" : "light";
    const nextPalette = resolvePalette(data.palette);
    setFontScale(nextFontScale);
    setTheme(nextTheme);
    setPalette(nextPalette);
    writeLocalPreferences(nextFontScale, nextTheme, nextPalette);
    applyAppearance(nextFontScale, nextTheme, nextPalette);
  }

  function updateFontScale(nextFontScale: number) {
    const safeScale = clampFontScale(nextFontScale);
    setFontScale(safeScale);
    writeLocalPreferences(safeScale, theme, palette);
    applyAppearance(safeScale, theme, palette);
  }

  function updateTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    writeLocalPreferences(fontScale, nextTheme, palette);
    applyAppearance(fontScale, nextTheme, palette);
  }

  function updatePalette(nextPalette: PaletteOption["id"]) {
    setPalette(nextPalette);
    writeLocalPreferences(fontScale, theme, nextPalette);
    applyAppearance(fontScale, theme, nextPalette);
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
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Tamanho da fonte</p>
                <p className="text-xs font-medium text-primary">{formatFontScale(fontScale)}</p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <Minus className="size-4" aria-hidden="true" />
                  <span>Padrao</span>
                  <Plus className="size-4" aria-hidden="true" />
                </div>
                <input
                  type="range"
                  min={MIN_FONT_SCALE}
                  max={MAX_FONT_SCALE}
                  step={FONT_SCALE_STEP}
                  value={fontScale}
                  aria-label="Tamanho da fonte"
                  className="w-full accent-primary"
                  onChange={(event) => updateFontScale(Number(event.target.value))}
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>60%</span>
                  <span>100%</span>
                  <span>175%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Paleta</p>
              <div className="grid gap-2">
                {PALETTE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary",
                      palette === option.id ? "border-primary bg-primary/10 text-primary" : "bg-background",
                    )}
                    onClick={() => updatePalette(option.id)}
                  >
                    {option.label}
                    {palette === option.id ? <Check className="size-4" aria-hidden="true" /> : null}
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

function applyAppearance(fontScale: number, theme: "light" | "dark", palette: PaletteOption["id"]) {
  document.documentElement.removeAttribute("data-font-size");
  document.documentElement.style.setProperty("--app-font-scale", String(clampFontScale(fontScale)));
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.palette = palette;
}

function writeLocalPreferences(fontScale: number, theme: "light" | "dark", palette: PaletteOption["id"]) {
  const safeScale = clampFontScale(fontScale);
  window.localStorage.setItem(FONT_KEY, String(safeScale));
  window.localStorage.setItem(LEGACY_FONT_KEY, String(safeScale));
  window.localStorage.setItem(THEME_KEY, theme);
  window.localStorage.setItem(PALETTE_KEY, palette);
}

async function saveServerPreferences({
  fontScale,
  theme,
  palette,
}: {
  fontScale: number;
  theme: "light" | "dark";
  palette: PaletteOption["id"];
}) {
  await fetch("/api/ui-preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fontScale: String(clampFontScale(fontScale)),
      theme,
      palette,
    }),
  }).catch(() => undefined);
}

function resolveFontScale(value: string | number | null | undefined) {
  if (value === "padrao" || value === "default" || value === "large" || value === "grande" || value === "muito_grande" || value === "maximo" || value === "xlarge" || value === "max") {
    return DEFAULT_FONT_SCALE;
  }
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", ".").replace("x", ""));
  return clampFontScale(Number.isFinite(parsed) ? parsed : DEFAULT_FONT_SCALE);
}

function clampFontScale(value: number) {
  const stepped = Math.round(value / FONT_SCALE_STEP) * FONT_SCALE_STEP;
  return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, Number(stepped.toFixed(2))));
}

function formatFontScale(value: number) {
  return `Tamanho da fonte: ${Math.round(clampFontScale(value) * 100)}%`;
}

function resolvePalette(value: string | null | undefined): PaletteOption["id"] {
  return PALETTE_OPTIONS.some((option) => option.id === value)
    ? (value as PaletteOption["id"])
    : "agrimensura_verde";
}
