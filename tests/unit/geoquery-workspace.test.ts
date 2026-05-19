import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = join(
  process.cwd(),
  "src",
  "components",
  "geoquery",
  "geoquery-workspace.tsx",
);

describe("GeoQueryWorkspace layout", () => {
  it("mantem controles tecnicos fora do formulario operacional", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("bufferMeters: 500");
    expect(source).toContain("sigefMinOverlap: 60");
    expect(source).toContain("sigefBufferMeters: 0");
    expect(source).toContain("showTechnicalSourcesPanel = false");

    expect(source).not.toContain('name="bufferMeters"');
    expect(source).not.toContain('name="sigefMinOverlap"');
    expect(source).not.toContain('name="sigefBufferMeters"');
    expect(source).not.toContain('data-testid="geoquery-buffer-input"');
    expect(source).not.toContain('data-testid="geoquery-sigef-overlap-input"');
    expect(source).not.toContain('data-testid="geoquery-sigef-buffer-input"');
  });
});
