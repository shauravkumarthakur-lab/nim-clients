import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const PORT = 3100;
const TEST_DB = process.env.E2E_DATABASE_URL ?? "postgresql://marginos:marginos_dev@localhost:5432/marginos_test?schema=public";
// Use the pre-installed Chromium when present (cloud dev environment); otherwise Playwright's own.
const executablePath = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }], ["json", { outputFile: "playwright-report/results.json" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", screenshot: "only-on-failure", launchOptions: { executablePath } },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 }, launchOptions: { executablePath } }, testIgnore: /mobile\.spec/ },
    { name: "android", use: { ...devices["Pixel 7"], launchOptions: { executablePath } }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: TEST_DB, APP_URL: `http://localhost:${PORT}`, DISABLE_RATE_LIMIT: "1", ENABLE_DEV_MAILBOX: "1", NEXT_DIST_DIR: ".next-e2e", ANTHROPIC_API_KEY: "" },
  },
});
