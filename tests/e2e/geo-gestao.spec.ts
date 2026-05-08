import { expect, test, type Page, type Response, type TestInfo } from "@playwright/test";

const testEmail = process.env.E2E_TEST_EMAIL;
const testPassword = process.env.E2E_TEST_PASSWORD;
const hasCredentials = Boolean(testEmail && testPassword);
const runMutationTests = process.env.E2E_RUN_MUTATION_TESTS === "true";
const loginPath = "/login";
const configuredSupabaseHost = safeHost(process.env.NEXT_PUBLIC_SUPABASE_URL);

type AuthResponseDiagnostics = {
  host: string;
  ok: boolean;
  status: number;
  message: string | null;
} | null;

function safeHost(value: string | undefined) {
  if (!value) return "nao configurado";
  try {
    return new URL(value).host;
  } catch {
    return "url invalida";
  }
}

function isSupabaseAuthTokenResponse(response: Response) {
  try {
    const url = new URL(response.url());
    return url.pathname.endsWith("/auth/v1/token");
  } catch {
    return false;
  }
}

function safeAuthMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const value =
    record.error_description ??
    record.msg ??
    record.message ??
    record.error;
  return typeof value === "string" ? value : null;
}

async function readAuthResponse(response: Response | null): Promise<AuthResponseDiagnostics> {
  if (!response) return null;

  let message: string | null = null;
  try {
    message = safeAuthMessage(await response.json());
  } catch {
    message = null;
  }

  return {
    host: safeHost(response.url()),
    ok: response.ok(),
    status: response.status(),
    message,
  };
}

async function isVisible(page: Page, testId: string, timeout = 1_000) {
  return page.getByTestId(testId).isVisible({ timeout }).catch(() => false);
}

async function loginDiagnostics(
  page: Page,
  testInfo: TestInfo,
  authResponse: AuthResponseDiagnostics,
) {
  const currentUrl = page.url();
  const currentPath = new URL(currentUrl).pathname;
  const stayedOnLogin = currentPath === loginPath;
  const appShellVisible = await isVisible(page, "app-shell");
  const credentialErrorVisible = await isVisible(page, "login-error");
  const credentialErrorText = credentialErrorVisible
    ? await page.getByTestId("login-error").textContent()
    : null;
  const loginReady = await page
    .getByTestId("login-form")
    .getAttribute("data-e2e-ready", { timeout: 1_000 })
    .catch(() => null);

  await testInfo
    .attach("login-diagnostics", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    })
    .catch(() => null);

  return [
    "Login E2E falhou.",
    `URL atual: ${currentUrl}`,
    `Host Supabase configurado: ${configuredSupabaseHost}`,
    `Formulario de login hidratado: ${loginReady === "true" ? "sim" : "nao"}`,
    `Continuou em /login: ${stayedOnLogin ? "sim" : "nao"}`,
    `Erro de credenciais visivel: ${credentialErrorVisible ? "sim" : "nao"}`,
    credentialErrorText ? `Mensagem de erro: ${credentialErrorText.trim()}` : null,
    authResponse
      ? `Resposta Supabase Auth: host=${authResponse.host} status=${authResponse.status} ok=${authResponse.ok ? "sim" : "nao"}`
      : "Resposta Supabase Auth: nao capturada",
    authResponse?.message ? `Mensagem Supabase Auth: ${authResponse.message}` : null,
    `app-shell visivel: ${appShellVisible ? "sim" : "nao"}`,
    "Screenshot anexado ao relatorio do Playwright como login-diagnostics.",
    "Verifique se NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY apontam para o Supabase de teste onde E2E_TEST_EMAIL existe.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function login(page: Page, testInfo: TestInfo) {
  if (!testEmail || !testPassword) {
    throw new Error("Configure E2E_TEST_EMAIL e E2E_TEST_PASSWORD.");
  }

  await page.goto(loginPath, { waitUntil: "domcontentloaded" });
  if (await isVisible(page, "app-shell", 5_000)) {
    return;
  }

  await expect(page.getByTestId("login-form")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("login-form")).toHaveAttribute(
    "data-e2e-ready",
    "true",
    { timeout: 15_000 },
  );
  await page.getByTestId("login-email").fill(testEmail);
  await page.getByTestId("login-password").fill(testPassword);
  await expect(page.getByTestId("login-email")).toHaveValue(testEmail);
  await expect(page.getByTestId("login-password")).toHaveValue(testPassword);

  const authResponsePromise = page
    .waitForResponse(isSupabaseAuthTokenResponse, { timeout: 30_000 })
    .catch(() => null);
  await page.getByTestId("login-submit").click();
  await Promise.race([
    page
      .waitForURL((url) => url.pathname !== loginPath, { timeout: 30_000 })
      .catch(() => null),
    page.getByTestId("login-error").waitFor({ state: "visible", timeout: 30_000 }),
    page.getByTestId("app-shell").waitFor({ state: "visible", timeout: 30_000 }),
  ]).catch(() => null);
  const authResponse = await readAuthResponse(await authResponsePromise);

  if (!(await isVisible(page, "app-shell", 30_000))) {
    throw new Error(await loginDiagnostics(page, testInfo, authResponse));
  }
}

test("login page carrega", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("GeoGestao")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acesse seu escritorio" })).toBeVisible();
  await expect(page.getByTestId("login-form")).toBeVisible();
});

test.describe("rotas autenticadas", () => {
  test.skip(!hasCredentials, "Defina E2E_TEST_EMAIL e E2E_TEST_PASSWORD para testar rotas autenticadas.");

  test.beforeEach(async ({ page }, testInfo) => {
    await login(page, testInfo);
  });

  test("dashboard carrega apos login", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("app-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("dashboard-title")).toHaveText("Dashboard");
    await expect(page.getByText("Total de clientes")).toBeVisible();
  });

  test("mapa carrega sem quebrar a rota", async ({ page }) => {
    await page.goto("/mapa");

    await expect(page.getByTestId("map-page")).toBeVisible();
    await expect(page.getByTestId("map-title")).toHaveText("Mapa");
  });
});

test.describe("fluxos criticos com escrita no banco", () => {
  test.skip(
    !hasCredentials || !runMutationTests,
    "Defina credenciais e E2E_RUN_MUTATION_TESTS=true apenas em banco Supabase de teste.",
  );

  test.beforeEach(async ({ page }, testInfo) => {
    await login(page, testInfo);
  });

  test("cliente, proposta, conversao, contrato, servico, pagamento e financeiro", async ({
    page,
  }) => {
    const suffix = Date.now();
    const clientName = `Cliente QA ${suffix}`;
    const proposalTitle = `Proposta QA ${suffix}`;

    await test.step("criar cliente", async () => {
      await page.goto("/clientes");
      await page.getByTestId("client-kind").selectOption("pj");
      await page.getByTestId("client-name").fill(clientName);
      await page.getByTestId("client-document").fill(`QA-${suffix}`);
      await page.getByTestId("client-email").fill(`qa-${suffix}@example.com`);
      await page.getByTestId("client-submit").click();
      await page.waitForURL(/\/clientes\/.+/);

      await page.goto("/clientes");
      await expect(page.getByText(clientName)).toBeVisible();
    });

    await test.step("criar proposta por modelo", async () => {
      await page.goto("/propostas");
      await page.getByTestId("new-proposal-button").click();
      await page.getByTestId("proposal-model-mode").click();
      await page.getByTestId("proposal-model-client").selectOption({ label: clientName });
      await page.getByTestId("proposal-model-title").fill(proposalTitle);
      await page.getByTestId("proposal-model-service-type").selectOption("georreferenciamento");
      await page.getByTestId("proposal-model-value").fill("12345");
      await page.getByTestId("proposal-model-submit").click();

      await expect(
        page.getByTestId("proposal-card").filter({ hasText: proposalTitle }),
      ).toBeVisible();
    });

    await test.step("converter proposta em servico sem criar receita", async () => {
      const proposalCard = page
        .getByTestId("proposal-card")
        .filter({ hasText: proposalTitle });
      await proposalCard.getByTestId("proposal-convert-button").click();

      await expect(page.getByTestId("proposal-column-execution")).toContainText(
        proposalTitle,
      );

      await page.goto("/contratos");
      await expect(page.getByTestId("contracts-card")).toContainText(proposalTitle);

      await page.goto("/servicos?board=georreferenciamento");
      await expect(
        page.getByTestId("service-card").filter({ hasText: proposalTitle }),
      ).toBeVisible();

      await page.goto("/financeiro");
      await expect(page.getByTestId("finance-revenues")).not.toContainText(
        `Pagamento recebido - ${proposalTitle}`,
      );
    });

    await test.step("pagamento cria receita e atualiza card", async () => {
      await page.goto("/propostas");
      const executionCard = page
        .getByTestId("proposal-column-execution")
        .getByTestId("proposal-card")
        .filter({ hasText: proposalTitle });
      await executionCard.getByTestId("proposal-payment-button").click();
      await expect(executionCard).toContainText("Pagamento efetuado");

      await page.goto("/financeiro");
      await expect(page.getByTestId("finance-revenues")).toContainText(
        `Pagamento recebido - ${proposalTitle}`,
      );

      await page.goto("/servicos?board=georreferenciamento");
      await expect(
        page.getByTestId("service-card").filter({ hasText: proposalTitle }),
      ).toContainText("Pagamento efetuado");
    });
  });
});
