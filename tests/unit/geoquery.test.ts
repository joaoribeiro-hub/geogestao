import { describe, expect, it } from "vitest";
import {
  geoLayerTargetTable,
  isValidCarCode,
  mapCarAttributes,
  mapIncraAttributes,
  normalizeCarCode,
  normalizeDbfFieldName,
  pickAttribute,
} from "@/lib/geoquery";
import { geoQuerySearchSchema } from "@/lib/schemas";

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
  });
});
