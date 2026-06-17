import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("appearance font size", () => {
  it("altera apenas escala de texto sem aplicar zoom global", () => {
    const widget = readFileSync(
      join(process.cwd(), "src/components/appearance/appearance-widget.tsx"),
      "utf8",
    );
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(widget).toContain('type="range"');
    expect(widget).toContain("MIN_FONT_SCALE = 0.6");
    expect(widget).toContain("DEFAULT_FONT_SCALE = 1");
    expect(widget).toContain("MAX_FONT_SCALE = 1.75");
    expect(widget).toContain("Tamanho da fonte:");
    expect(widget).not.toContain("1.7x");
    expect(widget).not.toContain("1.9x");
    expect(widget).not.toContain("2.1x");
    expect(widget).not.toContain("document.body.style.zoom");
    expect(widget).not.toContain("document.documentElement.style.zoom");
    expect(widget).toContain('setProperty("--app-font-scale"');
    expect(css).toContain("html {\n    font-size: 14px;");
    expect(css).not.toContain(':root[data-font-size="maximo"]');
    expect(css).toContain("font-size: calc(14px * var(--app-font-scale));");
  });
});
