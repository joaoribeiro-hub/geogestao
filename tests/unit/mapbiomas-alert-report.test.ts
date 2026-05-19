import { describe, expect, it } from "vitest";
import {
  buildMapBiomasAlertReportPdf,
  mapBiomasAlertReportFileName,
} from "@/lib/services/mapbiomas-alert-report";

describe("MapBiomas alert report PDF", () => {
  it("gera PDF interno GeoGestao com dados do alerta", () => {
    const pdf = buildMapBiomasAlertReportPdf({
      carCode: "GO-5219753-80EEBF1E6C744118A4C94B2EB35DAE83",
      alertCode: 1174369,
      generatedAt: new Date("2026-05-14T12:00:00Z"),
      alert: {
        alertCode: 1174369,
        areaHa: 49.7899,
        detectedAt: "2023-11-01",
        publishedAt: "2024-04-18",
        statusName: "Publicado",
        sources: ["MapBiomas Alerta"],
        ruralPropertiesCodes: ["GO-5219753-80EEBF1E6C744118A4C94B2EB35DAE83"],
        ruralPropertiesTotal: 4,
        crossedBiomesList: ["Cerrado"],
        crossedCitiesList: ["Pirenopolis"],
        crossedStatesList: ["GO"],
      },
    });

    const content = pdf.toString("ascii");
    expect(content).toContain("%PDF-1.4");
    expect(content).toContain("Laudo GeoGestao - Dados MapBiomas Alerta");
    expect(content).toContain("1174369");
    expect(content).toContain("Documento gerado pelo GeoGestao");
  });

  it("gera nome de arquivo seguro", () => {
    expect(
      mapBiomasAlertReportFileName(
        "GO-5219753-80EEBF1E6C744118A4C94B2EB35DAE83",
        1174369,
      ),
    ).toBe("laudo-geogestao-mapbiomas-GO-5219753-80EEBF1E6C744118A4C94B2EB35DAE83-1174369.pdf");
  });
});
