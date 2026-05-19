import { describe, expect, it } from "vitest";
import {
  extractAlertCarCode,
  extractAlertCode,
  geoLayerTargetTable,
  isValidCarCode,
  isSigefOverlapMatch,
  mergeGeoAlertMatches,
  mapCarAttributes,
  mapGeoAlertAttributes,
  mapIncraAttributes,
  normalizeCarCode,
  normalizeDbfFieldName,
  pickAttribute,
  splitGeoAlertsByNearby,
} from "@/lib/geoquery";
import { geoQuerySearchSchema } from "@/lib/schemas";
import { buildGeoImportRow } from "../../scripts/geo/geojson-import-utils";

describe("geoquery helpers", () => {
  it("normaliza e valida numero de CAR Federal", () => {
    expect(normalizeCarCode(" pr-1234567-ABC.def ")).toBe("PR-1234567-ABC.DEF");
    expect(isValidCarCode("PR-1234567-ABCDEF0000")).toBe(true);
    expect(isValidCarCode("123")).toBe(false);
    expect(
      geoQuerySearchSchema.safeParse({
        codCar: "PR-1234567-ABCDEF0000",
        bufferMeters: 500,
      }).success,
    ).toBe(true);
  });

  it("normaliza nomes de campos DBF e mapeia aliases do CAR", () => {
    const attributes = {
      "COD_CAR ": "PR-1234567-ABCDEF0000",
      "Município": "Londrina",
      "\u00c1rea_ha": "12,5",
      Situacao: "Ativo",
    };

    expect(normalizeDbfFieldName("Município")).toBe("municipio");
    expect(pickAttribute(attributes, ["cod_car"])).toBe("PR-1234567-ABCDEF0000");
    expect(mapCarAttributes(attributes)).toMatchObject({
      cod_car: "PR-1234567-ABCDEF0000",
      municipio: "Londrina",
      area_ha: 12.5,
      status_car: "Ativo",
    });
  });

  it("mapeia aliases INCRA e classifica destino de camadas", () => {
    const incra = mapIncraAttributes({
      SIGEF: "SIGEF-1",
      CNIR: "CNIR-1",
      "Codigo Imovel": "COD-1",
      Status: "Certificado",
    });

    expect(incra).toMatchObject({
      sigef_code: "SIGEF-1",
      cnir: "CNIR-1",
      codigo_imovel: "COD-1",
      situacao: "Certificado",
    });
    expect(geoLayerTargetTable.CAR_COMPLETA).toBe("car_properties");
    expect(geoLayerTargetTable.INCRA_PERIMETROS).toBe("incra_properties");
    expect(geoLayerTargetTable.ALERTA_DESMATAMENTO).toBe("geo_alert_layers");
    expect(geoLayerTargetTable.CAR_ALERT_INTERSECTION).toBe("geo_alert_layers");
  });

  it("mapeia car_with_alerts_and_intersections com aliases de alerta e CAR", () => {
    const mapped = mapGeoAlertAttributes({
      carCode: "GO-1234567-ABCDEF0000",
      cod_alerta: "ALERTA-361152",
      area_sobreposta: "3,5",
      area_do_alerta: "10.25",
    });

    expect(mapped).toMatchObject({
      cod_car: "GO-1234567-ABCDEF0000",
      alert_code: 361152,
      codigo_alerta: "ALERTA-361152",
      area_intersecao_ha: 3.5,
      area_alerta_ha: 10.25,
    });
    expect(extractAlertCode({ alertCode: "361152" })).toBe(361152);
    expect(extractAlertCarCode({ codigo_imovel: "GO-1234567-ABCDEF0000" })).toBe(
      "GO-1234567-ABCDEF0000",
    );
  });

  it("monta payload de importacao para alerta CAR_ALERT_INTERSECTION", () => {
    const row = buildGeoImportRow(
      {
        type: "Feature",
        properties: {
          cod_car: "GO-1234567-ABCDEF0000",
          cod_alerta: "361152",
          area_intersecao: "2,75",
          area_alerta: "8.5",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-50, -16],
              [-50, -15.9],
              [-49.9, -15.9],
              [-49.9, -16],
              [-50, -16],
            ],
          ],
        },
      },
      "CAR_ALERT_INTERSECTION",
    );

    expect(row).toMatchObject({
      layer_type: "car_alert_intersection",
      cod_car: "GO-1234567-ABCDEF0000",
      alert_code: 361152,
      codigo_alerta: "361152",
      area_intersecao_ha: 2.75,
      area_alerta_ha: 8.5,
    });
    expect(row.attributes).toMatchObject({ cod_alerta: "361152" });
    expect(row.geom_geojson).toMatchObject({ type: "Feature" });
  });

  it("aplica regra de sobreposicao minima SIGEF/CAR", () => {
    expect(isSigefOverlapMatch(0.6)).toBe(true);
    expect(isSigefOverlapMatch(0.75)).toBe(true);
    expect(isSigefOverlapMatch(0.59)).toBe(false);
  });

  it("separa alerta principal de alerta apenas proximo", () => {
    const { localAlerts, nearbyAlerts } = splitGeoAlertsByNearby([
      { id: "direct", alertCode: 1, matchType: "direct_code" },
      { id: "spatial", alertCode: 2, matchType: "spatial_intersection" },
      { id: "nearby", alertCode: 3, matchType: "spatial_buffer", isNearbyOnly: true },
    ]);

    expect(localAlerts.map((item) => item.id)).toEqual(["direct", "spatial"]);
    expect(nearbyAlerts.map((item) => item.id)).toEqual(["nearby"]);
  });

  it("mantem alerta local como principal e usa API apenas como complemento", () => {
    const merged = mergeGeoAlertMatches(
      [{ id: "local-1", alertCode: 361152, sourceLabel: "Base importada" }],
      [{ id: "api-1", alertCode: 361152, sourceLabel: "API MapBiomas", mapbiomasData: { ok: true } }],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "local-1",
      alertCode: 361152,
      sourceLabel: "Base importada + API MapBiomas",
      mapbiomasData: { ok: true },
    });
  });

  it("preserva todos os alertas locais quando ha alertas API diferentes", () => {
    const merged = mergeGeoAlertMatches(
      [
        { id: "local-1", alertCode: 1, sourceLabel: "Base importada" },
        { id: "local-2", alertCode: 2, sourceLabel: "Base importada" },
      ],
      [{ id: "api-3", alertCode: 3, sourceLabel: "API MapBiomas" }],
    );

    expect(merged.map((item) => item.id)).toEqual(["local-1", "local-2", "api-3"]);
  });
});
