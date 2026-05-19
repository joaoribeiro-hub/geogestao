import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("MapBiomas Alerta service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("faz signIn, cacheia token e consulta alerta por codigo", async () => {
    process.env.MAPBIOMAS_ALERT_EMAIL = "qa@example.test";
    process.env.MAPBIOMAS_ALERT_PASSWORD = "senha-fake";
    process.env.MAPBIOMAS_ALERT_API_URL = "https://mapbiomas.test/graphql";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { signIn: { token: "token-seguro-com-mais-de-vinte-caracteres" } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { alert: { alertCode: 361152, areaHa: 1.5 } } }));
    vi.stubGlobal("fetch", fetchMock);

    const { getAlertByCode } = await import("@/lib/services/mapbiomas-alert");
    const alert = await getAlertByCode(361152, "GO-123");

    expect(alert).toMatchObject({ alertCode: 361152, areaHa: 1.5 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const alertCall = fetchMock.mock.calls[1];
    expect(String(alertCall[1]?.body)).toContain("alert(alertCode");
    expect(alertCall[1]?.headers).toMatchObject({
      Authorization: "Bearer token-seguro-com-mais-de-vinte-caracteres",
    });
  });

  it("usa token direto e monta query ruralProperty com alertas do CAR", async () => {
    process.env.MAPBIOMAS_ALERT_TOKEN = "token-direto-com-mais-de-vinte-caracteres";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          ruralProperty: {
            propertyCode: "GO-123",
            alerts: [
              { alertCode: 1174369, areaHa: 49.7899, detectedAt: "2023-11-01", publishedAt: "2024-04-18" },
              { alertCode: 1305686, areaHa: 10, detectedAt: "2024-01-01", publishedAt: "2024-02-01" },
              { alertCode: 1313995, areaHa: 20, detectedAt: "2024-03-01", publishedAt: "2024-04-01" },
            ],
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getRuralPropertyAlerts } = await import("@/lib/services/mapbiomas-alert");
    const property = await getRuralPropertyAlerts("GO-123");

    expect(property).toMatchObject({ propertyCode: "GO-123" });
    expect((property?.alerts as unknown[] | undefined)?.map((item) => (item as { alertCode: number }).alertCode)).toEqual([
      1174369,
      1305686,
      1313995,
    ]);
    const body = String(fetchMock.mock.calls[0][1]?.body);
    expect(body).toContain("ruralProperty");
    expect(body).toContain("alerts {");
    expect(body).toContain("alertCode");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer token-direto-com-mais-de-vinte-caracteres",
    });
  });

  it("retorna ruralProperty sem alertas quando a API nao encontra alerta", async () => {
    process.env.MAPBIOMAS_ALERT_TOKEN = "token-direto-com-mais-de-vinte-caracteres";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          ruralProperty: {
            propertyCode: "GO-SEM-ALERTA",
            alerts: [],
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getRuralPropertyAlerts } = await import("@/lib/services/mapbiomas-alert");
    const property = await getRuralPropertyAlerts("GO-SEM-ALERTA");

    expect(property).toMatchObject({ propertyCode: "GO-SEM-ALERTA", alerts: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retorna null com mensagem clara quando alertCode nao pertence ao CAR", async () => {
    process.env.MAPBIOMAS_ALERT_TOKEN = "token-direto-com-mais-de-vinte-caracteres";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { alert: null } }))
      .mockResolvedValueOnce(jsonResponse({ data: { alert: null } }));
    vi.stubGlobal("fetch", fetchMock);

    const { getAlertReportLinkOrData } = await import("@/lib/services/mapbiomas-alert");
    const result = await getAlertReportLinkOrData(35953, "GO-123");

    expect(result.alert).toBeNull();
    expect(result.message).toContain("nao encontrou esse alerta para o CAR pesquisado");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("repete alert sem carCode quando alertCode nao e encontrado para o CAR", async () => {
    process.env.MAPBIOMAS_ALERT_TOKEN = "token-direto-com-mais-de-vinte-caracteres";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { alert: null } }))
      .mockResolvedValueOnce(jsonResponse({ data: { alert: { alertCode: 1174369, areaHa: 49.7899 } } }));
    vi.stubGlobal("fetch", fetchMock);

    const { getAlertReportLinkOrData } = await import("@/lib/services/mapbiomas-alert");
    const result = await getAlertReportLinkOrData(1174369, "GO-123");

    expect(result.alert).toMatchObject({ alertCode: 1174369, areaHa: 49.7899 });
    expect(result.message).toContain("sem o filtro de CAR");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain('"carCode":"GO-123"');
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain('"carCode":null');
  });

  it("tenta signIn quando token direto falha por autenticacao", async () => {
    process.env.MAPBIOMAS_ALERT_TOKEN = "token-direto-invalido-com-mais-de-vinte-caracteres";
    process.env.MAPBIOMAS_ALERT_EMAIL = "qa@example.test";
    process.env.MAPBIOMAS_ALERT_PASSWORD = "senha-super-secreta";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(statusResponse(401))
      .mockResolvedValueOnce(jsonResponse({ data: { signIn: { token: "token-novo-com-mais-de-vinte-caracteres" } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { alert: { alertCode: 1174369 } } }));
    vi.stubGlobal("fetch", fetchMock);

    const { getAlertByCode } = await import("@/lib/services/mapbiomas-alert");
    const alert = await getAlertByCode(1174369, "GO-123");

    expect(alert).toMatchObject({ alertCode: 1174369 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1]?.headers).toMatchObject({
      Authorization: "Bearer token-novo-com-mais-de-vinte-caracteres",
    });
  });

  it("nao expoe senha ou token em erro de autenticacao", async () => {
    process.env.MAPBIOMAS_ALERT_EMAIL = "qa@example.test";
    process.env.MAPBIOMAS_ALERT_PASSWORD = "senha-super-secreta";
    const fetchMock = vi.fn().mockResolvedValueOnce(statusResponse(401));
    vi.stubGlobal("fetch", fetchMock);

    const { getAlertByCode } = await import("@/lib/services/mapbiomas-alert");
    let message = "";
    try {
      await getAlertByCode(1174369, "GO-123");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("Nao foi possivel autenticar");
    expect(message).not.toContain("senha-super-secreta");
    expect(message).not.toContain("qa@example.test");
  });

  it("retorna erro claro quando credenciais nao estao configuradas", async () => {
    delete process.env.MAPBIOMAS_ALERT_EMAIL;
    delete process.env.MAPBIOMAS_ALERT_PASSWORD;
    delete process.env.MAPBIOMAS_ALERT_TOKEN;

    const { signInMapBiomas } = await import("@/lib/services/mapbiomas-alert");
    await expect(signInMapBiomas()).rejects.toThrow(
      "Nao foi possivel autenticar na API MapBiomas. Verifique as variaveis do servidor.",
    );
  });
});

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

function statusResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({}),
  } as Response;
}
