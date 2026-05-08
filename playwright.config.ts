import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const e2eHost = "127.0.0.1";
const e2ePort = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://${e2eHost}:${e2ePort}`;
const webServerEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);
const explicitE2EEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  E2E_TEST_EMAIL: process.env.E2E_TEST_EMAIL,
  E2E_TEST_PASSWORD: process.env.E2E_TEST_PASSWORD,
  E2E_RUN_MUTATION_TESTS: process.env.E2E_RUN_MUTATION_TESTS,
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --hostname ${e2eHost} --port ${e2ePort}`,
    env: {
      ...webServerEnv,
      ...Object.fromEntries(
        Object.entries(explicitE2EEnv).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
      PORT: String(e2ePort),
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "test-results",
});
