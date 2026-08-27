import { describe, expect, it, vi } from "vitest";
import { callWorkerWithRetry, getWorkerHealth, normalizeWorkerUrl } from "@/lib/workers/worker-client";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("worker-client", () => {
  it("normaliza URLs sem alterar o caminho do worker", () => {
    expect(normalizeWorkerUrl(" https://worker.onrender.com/ ")).toBe("https://worker.onrender.com");
  });

  it("consulta health sem enviar segredo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "ok", service: "buscageo" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getWorkerHealth("https://worker.onrender.com", { timeoutMs: 100 });

    expect(result.ok).toBe(true);
    expect(result.service).toBe("buscageo");
    expect(fetchMock.mock.calls[0]?.[1]).not.toMatchObject({ headers: expect.anything() });
  });

  it("acorda o worker após uma falha inicial e envia o segredo apenas na chamada protegida", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: "starting" }, 503))
      .mockResolvedValueOnce(jsonResponse({ status: "ok", service: "buscageo" }))
      .mockResolvedValueOnce(jsonResponse({ accepted: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callWorkerWithRetry({
      url: "https://worker-cold-start.onrender.com",
      secret: "server-only-secret",
      path: "/jobs/job-1/process",
      body: { job_id: "job-1" },
      maxWaitMs: 500,
      initialTimeoutMs: 50,
      retryDelayMs: 0,
    });

    expect(result.ok).toBe(true);
    expect(result.workerStatus).toBe("waking");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]).not.toMatchObject({ headers: expect.anything() });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ headers: { authorization: "Bearer server-only-secret" } });
  });

  it("bloqueia chamada quando URL ou segredo não estão configurados", async () => {
    const result = await callWorkerWithRetry({ url: "", secret: "", path: "/health" });
    expect(result.ok).toBe(false);
    expect(result.workerStatus).toBe("not_configured");
  });
});
