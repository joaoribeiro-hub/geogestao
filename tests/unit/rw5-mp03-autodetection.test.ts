import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { readUploadedText } from "@/lib/modules/shared-text";
import { applyMissingQualityFallbacks, buildRw5, buildRw5CoordinatesTable, generateEstimatedAge, normalizeSolution, parseRw5Text } from "@/lib/modules/rw5/converter";
import { resolveRw5EquipmentProfile } from "@/lib/modules/rw5/equipment";

describe("Gerador RW5 MP-03 autodeteccao", () => {
  it("detecta PTS20 CHCI50 sem deslocar HR/status/dops", () => {
    const parsed = parseRw5Text([
      "base_3,,8106303.025,648141.506,621.069,,,,,,,,,,0.000,,,,2026-02-19 07:51:41,2026-02-19 07:51:41",
      "1091,Tn,8106308.147,648144.695,620.354,0.010,0.008,0.017,Fixo,1.024,0.504,0.891,1.170,CHCI50,1.400,,,,2026-02-19 07:51:41,2026-02-19 07:51:41",
    ].join("\n"));
    const point = parsed.points.find((item) => item.id === "1091")!;

    expect(parsed.inputFormat).toBe("LAYOUT_B_PTS20_CHCI50_NE");
    expect(parsed.detectedAntennaType).toBe("CHCI50");
    expect(point.hrField).toBe(1.4);
    expect(point.metrics.status).toBe("FIXED");
    expect(point.metrics.pdop).toBe(1.024);
    expect(point.metrics.hdop).toBe(0.504);
    expect(point.metrics.vdop).toBe(0.891);
    expect(point.metrics.gdop).toBe(1.17);
  });

  it("detecta PTS24 CHCI93 direto e formata LA/LN compacto", () => {
    const parsed = parseRw5Text([
      "base_1,,8107146.902,644396.591,611.622,,,,,,,,,,,611.622,-49°38′33.75881″,-17°06′56.36581″,0.000,,,,2026-03-21 07:58:15,2026-03-21 07:58:15",
      "1,Conferencia,8107145.238,644402.192,609.969,0.009,0.009,0.018,Fixo,1.154,0.578,0.998,1.929,611.622,CHCI93 NONE,609.969,-49°38′33.56890″,-17°06′56.41867″,1.400,,,,2026-03-21 07:58:15,2026-03-21 07:58:15",
    ].join("\n"));
    const rw5 = buildTestRw5(parsed, "rogerio.txt", "i93-3247131");

    expect(parsed.inputFormat).toBe("LAYOUT_C_PTS24_NE_OR_EN");
    expect(parsed.baseMode).toBe("linked_base");
    expect(parsed.points.find((item) => item.id === "1")?.hrField).toBe(1.4);
    expect(rw5).toContain("BP,base_1,LA");
    expect(rw5).toContain("Base ID read at rover: base_1");
    expect(rw5).toContain("G1,BPbase_1,PN1");
    expect(rw5).not.toContain("--Base Configuration by Local Coordinate");
    expect(rw5).toContain("LS,HR1.4813");
    expect(rw5).toContain("--GS,PN1,N 8107145.2380,E 644402.1920,EL609.9690");
    expect(rw5).toContain("LA-17.065641867000");
    expect(rw5).not.toContain("LA0.0000");
    expect(rw5).not.toContain("LN8107");
  });

  it("captura DOPs, TDOP, GDOP e AGE de campo GNSS em layout simples", () => {
    const parsed = parseRw5Text([
      "base_2,,8106303.025,648141.506,621.069,0.0000,0,0.0,-,-,Autonomo,0.0000,0.0000,0.0000,0.0000,0.0000,2026-02-19 07:50:46,2026-02-19 07:50:46",
      "1330,Tn,8106308.145,648144.688,620.360,1.7000,1,1.0887457132339478,34,30,Fixo,0.0154,0.0076,0.0088,0.0116,0.0194,2026-02-19 07:50:46,2026-02-19 07:50:46,HRMS:0.013,VRMS:0.023,STATUS:FIXED,SATS:24,AGE:1.0,PDOP:1.154,HDOP:0.578,VDOP:0.999,TDOP:1.546,GDOP:1.929,NRMS:0.009,ERMS:0.009",
    ].join("\n"));
    const point = parsed.points.find((item) => item.id === "1330")!;
    const rw5 = buildTestRw5(parsed, "gnss-info.txt", "i93-3247131");

    expect(point.metrics.hdop).toBe(0.578);
    expect(point.metrics.vdop).toBe(0.999);
    expect(point.metrics.tdop).toBe(1.546);
    expect(point.metrics.gdop).toBe(1.929);
    expect(point.metrics.age).toBe(1);
    expect(rw5).toContain("HDOP: 0.578, VDOP: 0.999, TDOP: 1.546, GDOP: 1.929");
    expect(rw5).not.toContain("HDOP: 0.000, VDOP: 0.000, TDOP: 0.000, GDOP: 0.000");
  });

  it("usa modo base registrada quando encontra B_ e preserva base ID", () => {
    const parsed = parseRw5Text([
      "MC-01,635263.246,8104584.360,591.300,,0.000,0.000,0.000,Único,0.000,0.000,0.000,0.000,,,,591.300,-49°43′42.19831″,-17°08′21.74178″,2026-03-15 14:51:46,2026-03-15 14:51:46,",
      "B_3247131,644396.591,8107146.902,610.140,,,,,,,,,,,CHCI90,,610.140,-49°38′33.75879″,-17°06′56.36581″,2026-03-21 07:53:12,2026-03-21 07:53:12,",
      "1,644402.172,8107145.230,609.958,Conferencia,0.009,0.009,0.018,Fixo,1.154,0.578,0.999,1.929,610.140,CHCI93 NONE,,609.958,-49°38′33.56959″,-17°06′56.41893″,2026-03-21 07:58:26,2026-03-21 07:58:26,HRMS:0.013,VRMS:0.022,STATUS:FIXED,SATS:24,AGE:1.0,PDOP:1.154,HDOP:0.578,VDOP:0.999,TDOP:1.546,GDOP:1.929,NRMS:0.009,ERMS:0.009",
    ].join("\n"));
    const rw5 = buildTestRw5(parsed, "josivaldo.txt", "i93-3247131", "i90-3781866-modelo");

    expect(parsed.baseMode).toBe("registered_base");
    expect(parsed.baseUsed).toBe("B_3247131");
    expect(parsed.detectedBaseAntennaType).toBe("CHCI90");
    expect(parsed.controlPointCount).toBe(1);
    expect(rw5).toContain("--Base Configuration by Local Coordinate");
    expect(rw5).toContain("BP,PN,LA");
    expect(rw5).toContain("Base ID read at rover: B_3247131");
    expect(rw5).toContain("G1,BPB_3247131,PN1");
    expect(rw5).toContain("--GS,PN1,N 8107145.2300,E 644402.1720,EL609.9580");
    expect(rw5).toContain("--HSDV: 0.013, VSDV: 0.022, STATUS: FIXED, SATS: 24, AGE: 1.0, PDOP: 1.154, HDOP: 0.578, VDOP: 0.999, TDOP: 1.546, GDOP: 1.929");
    expect(rw5).not.toContain("AGE: 0.0, PDOP: 1.154, HDOP: 0.000");
    expect(rw5).not.toContain("LA0.0000");
  });

  it("usa offset i83 em PTS35 e extrai HR da base B_", () => {
    const parsed = parseRw5Text([
      "B_3399386_2,,8106303.025,648141.506,621.069,,,,,\"SH = 1.322 m; Ponto B_3399386_2 na lista de pontos\",,,,,,,,CHCI83,1.322,2026-02-19 07:43:16,2026-02-19 07:43:16,,,,,,,,,,,,,,",
      "base_1,,8106303.025,648141.506,621.069,,,,,,,,,,,,,,1.322,2026-02-19 07:56:25,2026-02-19 07:56:25,,,,,,,,,,,,,,",
      "676,Cerca,8106306.798,648144.217,620.649,0.008,0.009,0.020,0.012,,1.078,0.533,0.937,1.822,Fixo,30,,CHCI83,1.480,2026-02-19 07:56:25,2026-02-19 07:56:25,HRMS:0.012,VRMS:0.020,STATUS:FIXED,SATS:30,AGE:3.0,PDOP:1.078,HDOP:0.533,VDOP:0.937,TDOP:1.469,GDOP:1.822,NRMS:0.008,ERMS:0.009",
    ].join("\n"));
    const rw5 = buildTestRw5(parsed, "tiago.txt", "i83-4005499", "i83-4005499");

    expect(parsed.baseMode).toBe("registered_base");
    expect(parsed.detectedAntennaType).toBe("CHCI83");
    expect(parsed.points.find((item) => item.id === "B_3399386_2")?.hrField).toBe(1.322);
    expect(parsed.points.find((item) => item.id === "676")?.hrField).toBe(1.48);
    expect(rw5).toContain("LS,HR1.5573");
    expect(rw5).toContain("CHCI83");
    expect(rw5).not.toContain("EL0.0000");
  });

  it("preserva ponto alfanumerico MP03 como rover no layout MC18", () => {
    const parsed = parseRw5Text([
      "base_2,,8106303.025,648141.506,621.069,0.0000,0,0.0,-,-,Autonomo,0.0000,0.0000,0.0000,0.0000,0.0000,2026-02-19 07:50:46,2026-02-19 07:50:46",
      "1330,Tn,8106308.145,648144.688,620.360,1.7000,1,1.0887457132339478,34,30,Fixo,0.0154,0.0076,0.0088,0.0116,0.0194,2026-02-19 07:50:46,2026-02-19 07:50:46",
      "MP03,Marco,8103922.484,649153.799,688.211,1.7000,1,1.100,34,30,Fixo,0.015,0.008,0.009,0.012,0.019,2026-02-19 10:00:00,2026-02-19 10:00:00",
    ].join("\n"));
    const rw5 = buildTestRw5(parsed, "josivaldo-mp03.txt", "i93-3247131");

    expect(parsed.inputFormat).toBe("LAYOUT_A_MC18_NE");
    expect(parsed.alphanumericPointCount).toBe(1);
    expect(parsed.points.find((item) => item.id === "MP03")).toBeTruthy();
    expect(rw5).toContain("GPS,PNMP03");
    expect(rw5).toContain("--GS,PN1330,N 8106308.1450,E 648144.6880,EL620.3600");
    expect(rw5).not.toContain("--GS,PN1330,N 620.360");
  });

  it("gera estatistica completa por ponto e antena no formato da coletora", () => {
    const parsed = parseRw5Text([
      "base_1,,8107146.902,644396.591,611.622,,,,,,,,,,,611.622,-49°38′33.75881″,-17°06′56.36581″,0.000,,,,2026-03-21 07:58:15,2026-03-21 07:58:15",
      "1,Conferencia,8107145.238,644402.192,609.969,0.009,0.009,0.018,Fixo,1.154,0.578,0.998,1.929,611.622,CHCI93 NONE,609.969,-49°38′33.56890″,-17°06′56.41867″,1.400,,,,2026-03-21 07:58:15,2026-03-21 07:58:15",
    ].join("\n"));
    const rw5 = buildTestRw5(parsed, "rogerio.txt", "i93-3247131");

    [
      "--Valid Readings",
      "--Fixed Readings",
      "--Nor Min",
      "--Eas Min",
      "--Elv Min",
      "--Nor Avg",
      "--Eas Avg",
      "--Elv Avg",
      "--NRMS Avg",
      "--ERMS Avg",
      "--VSDV Avg",
      "--HDOP Avg",
      "--VDOP Avg",
      "--PDOP Avg",
      "--AGE Avg",
      "--DT",
      "--TM",
    ].forEach((line) => expect(rw5).toContain(line));
    expect(rw5).not.toContain("--HSDV Avg");
    expect(rw5).toContain("--Number of Satellites Avg:");
    expect(rw5).toContain("--Antenna Type: [CHCI93 NONE],RA0.124m,SHMP0.0000m,L10.0813m,L20.0813m");
    expect(rw5).toContain("GPS,PN1,LA-17.065641867000,LN-49.383356890000,EL611.450300");
    expect(rw5).toContain("--HDOP Avg: 0.5780 MIN: 0.5780 MAX: 0.5780");
    expect(rw5).toContain("--VDOP Avg: 0.9980 MIN: 0.9980 MAX: 0.9980");
    expect(rw5).toContain("--PDOP Avg: 1.1540 MIN: 1.1540 MAX: 1.1540");
    expect(rw5).toContain("--AGE Avg: 1.0000 MIN: 1.0000 MAX: 1.0000");
    expect(rw5).not.toContain("RA0.1240m");
    expect(rw5).not.toContain("SHMP0.0m");
    expect(rw5).not.toContain("User Defined: SIRGAS 2000 _ UTM zone 22S_1");
  });

  it("nao soma antena na base e soma HR/L1 somente no GPS dos pontos comuns", () => {
    const parsed = parseRw5Text([
      "base_1,,8108978.923,647249.740,550.735,1.7000,,,,,,,,,,,550.735,-49°36′57.61787″,-17°05′55.91198″,0.000,,,,2026-02-14 07:53:00,2026-02-14 07:53:00",
      "164,Crista,8108985.629,647254.968,550.735,1.7000,0.009,0.009,Fixo,1.154,0.578,0.998,1.929,550.735,CHCI93 NONE,550.735,-49°36′57.49654″,-17°05′58.92604″,1.7000,,,,2026-02-14 07:53:00,2026-02-14 07:53:00",
    ].join("\n"));
    const rw5 = buildTestRw5(parsed, "josivaldo-mp02.txt", "i93-3781866");
    const lines = rw5.split(/\r?\n/);
    const baseBpLine = lines.find((line) => line.startsWith("BP,base_1,")) ?? "";
    const pointGpsLine = lines.find((line) => line.startsWith("GPS,PN164,")) ?? "";
    const pointGsLine = lines.find((line) => line.startsWith("--GS,PN164,")) ?? "";

    expect(rw5).toContain("--Antenna Type: [CHCI93 NONE],RA0.124m,SHMP0.0000m,L10.0813m,L20.0813m");
    expect(rw5).toContain("--Entered Rover HR: 1.7000 m,Vertical");
    expect(rw5).toContain("LS,HR1.7813");
    expect(baseBpLine).toContain("EL550.7350");
    expect(baseBpLine).not.toContain("EL552.5163");
    expect(pointGpsLine).toContain("EL552.516300");
    expect(pointGsLine).toContain("EL550.7350");
  });

  it("exporta a mesma latitude/longitude LA/LN usada no RW5", () => {
    const parsed = parseRw5Text([
      "base_1,,8108978.923,647249.740,550.735,1.7000,,,,,,,,,,,550.735,-49°36′57.61787″,-17°05′55.91198″,0.000,,,,2026-02-14 07:53:00,2026-02-14 07:53:00",
      "164,Crista,8108985.629,647254.968,550.735,1.7000,0.009,0.009,Fixo,1.154,0.578,0.998,1.929,550.735,CHCI93 NONE,550.735,-49°36′57.49654″,-17°05′58.92604″,1.7000,,,,2026-02-14 07:53:00,2026-02-14 07:53:00",
    ].join("\n"));
    const rw5 = buildTestRw5(parsed, "josivaldo-mp02.txt", "i93-3781866");
    const table = buildRw5CoordinatesTable(parsed.points, parsed.crs);
    const point = parsed.points.find((item) => item.id === "164")!;
    const rw5Gps = rw5.split(/\r?\n/).find((line) => line.startsWith("GPS,PN164,"))!;
    const row = table.split(/\r?\n/).find((line) => line.startsWith("164\t"))!;
    const [, latitude, longitude] = row.split("\t");

    expect(table.split(/\r?\n/)[0]).toBe("Nome\tlatitude\tlongitude");
    expect(latitude).toBe(point.latRw5);
    expect(longitude).toBe(point.lonRw5);
    expect(rw5Gps).toContain(`LA${latitude},LN${longitude}`);
  });

  it("resolve os dois perfis i50 com firmware preenchido", () => {
    expect(resolveRw5EquipmentProfile({ selected: "i50-3399386", detected: "CHCI50", role: "rover" }).firmware).toBe("1.3.8.2");
    expect(resolveRw5EquipmentProfile({ selected: "i50-3400353", detected: "CHCI50", role: "base" }).firmware).toBe("1.3.8.2");
  });

  it("gera RW5 com perfil i50-3399386 agora completo", () => {
    const parsed = parseRw5Text([
      "base_3,,8106303.025,648141.506,621.069,,,,,,,,,,0.000,,,,2026-02-19 07:51:41,2026-02-19 07:51:41",
      "1091,Tn,8106308.147,648144.695,620.354,0.010,0.008,0.017,Fixo,1.024,0.504,0.891,1.170,CHCI50,1.400,,,,2026-02-19 07:51:41,2026-02-19 07:51:41",
    ].join("\n"));

    const rw5 = buildTestRw5(parsed, "rogerio-i50.txt", "i50-3399386");
    expect(rw5).toContain("--Equipment: i50,CONNECTION_WIFI,SN: 3399386,FW: 1.3.8.2");
  });

  it("mantem SATS e AGE reais quando existem no arquivo", () => {
    const parsed = parseRw5Text([
      "base_2,,8106303.025,648141.506,621.069,0.0000,0,0.0,-,-,Autonomo,0.0000,0.0000,0.0000,0.0000,0.0000,2026-02-19 07:50:46,2026-02-19 07:50:46",
      "1330,Tn,8106308.145,648144.688,620.360,1.7000,1,1.0887457132339478,34,30,Fixo,0.0154,0.0076,0.0088,0.0116,0.0194,2026-02-19 07:50:46,2026-02-19 07:50:46,STATUS:FIXED,SATS:24,AGE:1.0",
    ].join("\n"));
    const point = parsed.points.find((item) => item.id === "1330")!;

    expect(point.metrics.satsSummary).toBe(24);
    expect(point.satsSource).toBe("arquivo");
    expect(point.metrics.age).toBe(1);
    expect(point.ageSource).toBe("arquivo");
    expect(parsed.validation.avisos.join("\n")).not.toContain("Ponto 1330: SATS estimado");
    expect(parsed.validation.avisos.join("\n")).not.toContain("Ponto 1330: AGE estimado");
  });

  it("usa satelites usados antes de rastreados quando nao ha SATS explicito", async () => {
    const file = await makeXlsxFile([
      finalHeader(),
      ["base_1", "8108978.923", "647249.740", "550.735", "", "", "", "SH = 1.608 m", "", "", "", "", "", "", "", "", "", "", "", "", "CHCI50", "1.608", "2026-02-14 07:46:33", "2026-02-14 07:46:33"],
      ["164", "8108985.629", "647254.968", "550.735", "Crista", "", "", "", "0.0093", "0.0095", "0.0187", "0.0133", "0.0240", "1.245", "0.599", "1.091", "1.450", "34", "30", "Fixo", "CHCI93 NONE", "1.700", "2026-02-14 07:53:00", "2026-02-14 07:53:00"],
    ]);
    const uploaded = await readUploadedText(file);
    const parsed = parseRw5Text(uploaded.text, { encoding: uploaded.encoding, sourceName: file.name });
    const point = parsed.points.find((item) => item.id === "164")!;

    expect(point.trackedSats).toBe(34);
    expect(point.usedSats).toBe(30);
    expect(point.metrics.satsSummary).toBe(30);
    expect(point.satsSource).toBe("arquivo");
  });

  it("estima SATS ausente de forma deterministica entre 25 e 32 sem repetir mais de 5 vezes", () => {
    const rows = [
      "base_3,,8106303.025,648141.506,621.069,,,,,,,,,,0.000,,,,2026-02-19 07:51:41,2026-02-19 07:51:41",
      ...Array.from({ length: 24 }, (_, index) => {
        const id = 2000 + index;
        return `${id},Tn,81063${String(index).padStart(2, "0")}.147,6481${String(index).padStart(2, "0")}.695,620.354,0.010,0.008,0.017,Fixo,1.024,0.504,0.891,1.170,CHCI50,1.400,,,,2026-02-19 07:51:41,2026-02-19 07:51:41`;
      }),
    ];
    const first = parseRw5Text(rows.join("\n"), { sourceName: "sem-sats.txt" });
    const second = parseRw5Text(rows.join("\n"), { sourceName: "sem-sats.txt" });
    const values = first.points.filter((point) => !point.isBase).map((point) => point.metrics.satsSummary);

    expect(values).toEqual(second.points.filter((point) => !point.isBase).map((point) => point.metrics.satsSummary));
    expect(values.every((value) => Number.isInteger(value) && value >= 25 && value <= 32)).toBe(true);
    let repeatCount = 1;
    for (let index = 1; index < values.length; index += 1) {
      repeatCount = values[index] === values[index - 1] ? repeatCount + 1 : 1;
      expect(repeatCount).toBeLessThanOrEqual(5);
    }
    expect(first.validation.avisos.some((warning) => warning.includes("SATS estimado por ausencia no arquivo"))).toBe(true);
  });

  it("usa AGE manual antes de estimar e estima AGE com pesos normalizados", () => {
    const parsed = parseRw5Text([
      "base_3,,8106303.025,648141.506,621.069,,,,,,,,,,0.000,,,,2026-02-19 07:51:41,2026-02-19 07:51:41",
      "1091,Tn,8106308.147,648144.695,620.354,0.010,0.008,0.017,Fixo,1.024,0.504,0.891,1.170,CHCI50,1.400,,,,2026-02-19 07:51:41,2026-02-19 07:51:41",
    ].join("\n"));
    const manual = applyMissingQualityFallbacks(parsed.points, { fileName: "idade-manual.txt", defaultAge: 4, applyAge: true });
    const manualPoint = manual.points.find((point) => point.id === "1091")!;
    const estimated = Array.from({ length: 220 }, (_, index) => generateEstimatedAge(`idade-estimada|${index}`));
    const mainGroup = estimated.filter((value) => value === 2 || value === 3).length;
    const secondaryGroup = estimated.filter((value) => [5, 6, 7].includes(value)).length;

    expect(manualPoint.metrics.age).toBe(4);
    expect(manualPoint.ageSource).toBe("manual");
    expect(new Set(estimated)).toEqual(new Set([2, 3, 5, 6, 7]));
    expect(mainGroup).toBeGreaterThan(secondaryGroup);
  });

  it("normaliza tipo de solucao com e sem acento", () => {
    expect(normalizeSolution("Autonomo")).toBe("AUTONOMOUS");
    expect(normalizeSolution("Autônomo")).toBe("AUTONOMOUS");
    expect(normalizeSolution("AUTONOMO")).toBe("AUTONOMOUS");
    expect(normalizeSolution("Fixo")).toBe("FIXED");
    expect(normalizeSolution("fixo")).toBe("FIXED");
    expect(normalizeSolution("Flutuante")).toBe("FLOAT");
  });

  it("le planilha XLSX como linhas tabulares antes de detectar MP-03", async () => {
    const file = await makeXlsxFile([
      [
        "base_3",
        "",
        "8106303.025",
        "648141.506",
        "621.069",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "0.000",
        "",
        "",
        "",
        "2026-02-19 07:51:41",
        "2026-02-19 07:51:41",
      ],
      [
        "1091",
        "Tn",
        "8106308.147",
        "648144.695",
        "620.354",
        "0.010",
        "0.008",
        "0.017",
        "Fixo",
        "1.024",
        "0.504",
        "0.891",
        "1.170",
        "CHCI50",
        "1.400",
        "",
        "",
        "",
        "2026-02-19 07:51:41",
        "2026-02-19 07:51:41",
      ],
    ]);
    const uploaded = await readUploadedText(file);
    const parsed = parseRw5Text(uploaded.text, { encoding: uploaded.encoding, sourceName: file.name });

    expect(uploaded.encoding).toBe("xlsx");
    expect(parsed.inputFormat).toBe("LAYOUT_B_PTS20_CHCI50_NE");
    expect(parsed.pointCount).toBe(1);
    expect(parsed.points.find((item) => item.id === "1091")?.timestamp).toBe("2026-02-19 07:51:41");
  });

  it("detecta XLSX com cabecalho Nome n e h Codigo sem deslocar coordenadas", async () => {
    const file = await makeXlsxFile([
      [
        "Nome",
        "n",
        "e",
        "h",
        "Código",
        "Altura da Antena",
        "Número de Observações",
        "PDOP",
        "Satélites Rastreados",
        "Satélites Usados",
        "Solução",
        "Erro RMS",
        "Precisão X",
        "Precisão Y",
        "Erro Horizontal",
        "Erro Vertical",
        "Horário Inicial",
        "Horário Final",
      ],
      [
        "base_1",
        "8106303.025",
        "648141.506",
        "621.069",
        "19",
        "",
        "0",
        "0.0",
        "-",
        "-",
        "Autônomo",
        "0.0000",
        "0.0000",
        "0.0000",
        "0.0000",
        "0.0000",
        "2026-02-19 07:50:46",
        "2026-02-19 07:50:46",
      ],
      [
        "1330",
        "8106308.145",
        "648144.688",
        "620.440",
        "Tn",
        "1.7000",
        "1",
        "1.0887457132339478",
        "34",
        "30",
        "Fixo",
        "0.0154",
        "0.0076",
        "0.0088",
        "0.0116",
        "0.0194",
        "2026-02-19 07:50:46",
        "2026-02-19 07:50:46",
      ],
    ]);
    const uploaded = await readUploadedText(file);
    const parsed = parseRw5Text(uploaded.text, { encoding: uploaded.encoding, sourceName: file.name });
    const point = parsed.points.find((item) => item.id === "1330");

    expect(parsed.sourceFormat).toBe("LAYOUT_F_XLSX_N_E_H_CODE");
    expect(point?.northing).toBe(8106308.145);
    expect(point?.easting).toBe(648144.688);
    expect(point?.elevation).toBe(620.44);
    expect(point?.description).toBe("Tn");
    expect(point?.hrField).toBe(1.7);
    expect(point?.timestamp).toBe("2026-02-19 07:50:46");
  });

  it("normaliza as 24 colunas do MODELO FINALL sem deslocar DOP, receptor ou horarios", async () => {
    const file = await makeXlsxFile([
      finalHeader(),
      ["B_3399386_6", "8108978.923", "647249.740", "551.653", "", "", "", "SH = 1.608 m", "", "", "", "", "", "", "", "", "", "", "", "", "CHCI50", "1.608", "2026-02-14 07:46:33", "2026-02-14 07:46:33"],
      ["1050", "8108986.172", "647254.617", "550.723", "Tn", "", "", "", "0.0093", "0.0095", "0.0187", "0.0133", "0.0240", "1.245", "0.599", "1.091", "1.450", "31", "21", "Fixo", "CHCI83", "1.480", "2026-02-14 07:56:33", "2026-02-14 07:56:33"],
    ]);
    const uploaded = await readUploadedText(file);
    const parsed = parseRw5Text(uploaded.text, { encoding: uploaded.encoding, sourceName: "Tiago_MP-02_Dia.14.02.2026.xlsx" });
    const point = parsed.points.find((item) => item.id === "1050")!;

    expect(parsed.sourceFormat).toBe("LAYOUT_F_XLSX_N_E_H_CODE");
    expect(parsed.baseMode).toBe("registered_base");
    expect(parsed.baseUsed).toBe("B_3399386_6");
    expect(parsed.points.map((item) => item.id)).toEqual(["B_3399386_6", "1050"]);
    expect(point.description).toBe("Tn");
    expect(point.antenna).toBe("CHCI83");
    expect(point.metrics).toMatchObject({ pdop: 1.245, hdop: 0.599, vdop: 1.091, gdop: 1.45, satsAvg: 21, satsSummary: 21 });
    expect(point.timestamp).toBe("2026-02-14 07:56:33");
    expect(parsed.validation.lat_lon_calculadas).toBe(2);
  });

  it("usa data da obra no JB e o padrao Vertical para B_", () => {
    const parsed = parseRw5Text([
      "B_4005499,,8107146.902,644396.591,610.140,1.376,0,1.0,30,25,Fixo,0.010,0.009,0.013,0.023,2026-03-21 07:53:12,2026-03-21 07:53:12,HRMS:0.013,VRMS:0.023,STATUS:FIXED,SATS:25,AGE:1.0,PDOP:1.154,HDOP:0.578,VDOP:0.999,TDOP:1.546,GDOP:1.929,NRMS:0.009,ERMS:0.009",
      "1,Tn,8107145.238,644402.192,609.969,1.480,1,1.154,30,25,Fixo,0.018,0.009,0.009,0.013,0.023,2026-03-21 07:58:15,2026-03-21 07:58:15,HRMS:0.013,VRMS:0.023,STATUS:FIXED,SATS:25,AGE:1.0,PDOP:1.154,HDOP:0.578,VDOP:0.999,TDOP:1.546,GDOP:1.929,NRMS:0.009,ERMS:0.009",
    ].join("\n"));
    parsed.points[0].antenna = "CHCI83";
    parsed.points[1].antenna = "CHCI83";
    const rw5 = buildRw5({
      points: parsed.points,
      filename: "teste.txt",
      jobName: "OBRA-01",
      jobCreationDate: "2026-03-20",
      jobCreationTime: "18:30:00",
      equipment: "i83-4005499",
      baseEquipment: "i83-4005499",
    });

    expect(rw5).toContain("JB,NMOBRA-01,DT03-20-2026,TM18:30:00");
    expect(rw5).toContain("--Entered Base HR: 1.376,Vertical");
    expect(rw5).toContain("--DT2026-03-21");
    expect(rw5).not.toContain("SIRGAS 2000 _ UTM zone 22S_1");
  });
});

function finalHeader() {
  return ["Nome", "Norte (N)", "Leste (E)", "Elevação", "Código", "Latitude", "Longitude", "Descrição", "Precisão X", "Precisão Y", "Erro RMS", "Erro Horizontal", "Erro Vertical", "PDOP", "HDOP", "VDOP", "GDOP", "Satélites Rastreados", "Satélites Usados", "Tipo de Solução", "RECPTOR", "Altura da antena", "Horário Inicial", "Horário Final"];
}

function buildTestRw5(
  parsed: ReturnType<typeof parseRw5Text>,
  filename: string,
  equipment: string,
  baseEquipment = "auto",
) {
  return buildRw5({
    points: parsed.points,
    filename,
    outputFilename: filename,
    jobName: "JOB-TESTE",
    jobCreationDate: "2026-02-01",
    jobCreationTime: "07:00:00",
    equipment,
    baseEquipment,
    defaultAge: 1,
  });
}

async function makeXlsxFile(rows: string[][]) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Planilha1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => value === "" ? `<c r="${columnName(columnIndex)}${rowIndex + 1}"/>` : `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData>
</worksheet>`);
  const content = await zip.generateAsync({ type: "uint8array" });
  const fileBuffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
  return new File([fileBuffer], "Josivaldo_MP-03 Dia.19.02.2026.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function columnName(index: number) {
  let value = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
