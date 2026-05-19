import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(
  join(process.cwd(), "src", "app", "api", "geoquery", "search", "route.ts"),
  "utf8",
);

describe("GeoQuery search route", () => {
  it("nao usa MapBiomas para decidir alertas da busca principal", () => {
    expect(routeSource).not.toContain("@/lib/services/mapbiomas-alert");
    expect(routeSource).not.toContain("getRuralPropertyAlerts");
    expect(routeSource).not.toContain("findMapBiomasAlerts");
    expect(routeSource).toContain("const apiAlerts: GeoAlertMatch[] = []");
    expect(routeSource).toContain("const alertsInside = importedAlertResult.localAlerts");
    expect(routeSource).toContain("p_include_nearby: includeNearbyAlerts");
  });
});
