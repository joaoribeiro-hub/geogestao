import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGeoImportRow } from "../../scripts/geo/geojson-import-utils";
import { streamGeoJsonFeatures } from "../../scripts/geo/geojson-stream";

describe("geojson streaming import helpers", () => {
  it("le FeatureCollection pequena por streaming e mapeia linha CAR", async () => {
    const fixture = join(process.cwd(), "tests/fixtures/geo/sample-feature-collection.json");
    const features = [];

    for await (const feature of streamGeoJsonFeatures(fixture)) {
      features.push(feature);
    }

    expect(features).toHaveLength(2);
    const row = buildGeoImportRow(features[0], "CAR_COMPLETA");
    expect(row).toMatchObject({
      cod_car: "PR-1234567-ABCDEF0000",
      municipio: "Londrina",
      uf: "PR",
      area_ha: 12.5,
    });
    expect(row.bbox).toEqual([-51.1, -23.1, -51, -23]);
  });
});
