import { expect, test, type Page } from "@playwright/test";

const testEmail = process.env.E2E_TEST_EMAIL;
const testPassword = process.env.E2E_TEST_PASSWORD;
const hasCredentials = Boolean(testEmail && testPassword);
const runMutationTests = process.env.E2E_RUN_MUTATION_TESTS === "true";

async function login(page: Page) {
  if (!testEmail || !testPassword) {
    throw new Error("Configure E2E_TEST_EMAIL e E2E_TEST_PASSWORD.");
  }

  await page.goto("/login");
  await page.getByTestId("login-email").fill(testEmail);
  await page.getByTestId("login-password").fill(testPassword);
  await page.getByTestId("login-submit").click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("login page carrega", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("GeoGestao")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acesse seu escritorio" })).toBeVisible();
  await expect(page.getByTestId("login-form")).toBeVisible();
});

test.describe("rotas autenticadas", () => {
  test.skip(!hasCredentials, "Defina E2E_TEST_EMAIL e E2E_TEST_PASSWORD para testar rotas autenticadas.");

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("dashboard carrega apos login", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Total de clientes")).toBeVisible();
  });

  test("mapa carrega sem quebrar a rota", async ({ page }) => {
    await page.goto("/mapa");

    await expect(page.getByTestId("map-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mapa" })).toBeVisible();
  });
});

test.describe("fluxos criticos com escrita no banco", () => {
  test.skip(
    !hasCredentials || !runMutationTests,
    "Defina credenciais e E2E_RUN_MUTATION_TESTS=true apenas em banco Supabase de teste.",
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
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
