import { expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "postgresql://marginos:marginos_dev@localhost:5432/marginos_test?schema=public" } } });
export const uid = () => Math.random().toString(36).slice(2, 8);
export const today = () => new Date().toISOString().slice(0, 10);
export const PASSWORD = "Secure-pass-2026";

export async function signup(page: Page, name: string, email: string, password = PASSWORD) {
  await page.goto("/signup");
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");
}

/** Full 5-screen onboarding. Optional team member and client. */
export async function onboard(page: Page, agency: string, opts: { employee?: { name: string; salary: string }; client?: { name: string; value: string } } = {}) {
  await page.fill("#name", agency);
  await page.getByTestId("onboarding-next").click();
  await page.selectOption("#cur", "INR");
  await page.getByTestId("onboarding-next").click();
  if (opts.employee) {
    await page.getByRole("button", { name: "Add team member" }).click();
    await page.getByLabel("Name", { exact: true }).fill(opts.employee.name);
    await page.getByLabel("Designation").fill("Video Editor");
    await page.getByLabel("Monthly salary").fill(opts.employee.salary);
  }
  await page.getByTestId("onboarding-next").click();
  await expect(page.getByText("Expense categories")).toBeVisible();
  await page.getByTestId("onboarding-next").click();
  if (opts.client) {
    await page.getByRole("button", { name: "Add client" }).click();
    await page.getByLabel("Client name").fill(opts.client.name);
    await page.getByLabel("Contract value").fill(opts.client.value);
  }
  await page.getByTestId("onboarding-next").click();
  await page.waitForURL("**/dashboard");
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Open a FormDialog by its testId, fill fields, submit, and wait for it to close. */
export async function submitDialog(page: Page, testId: string, fill: Record<string, string | boolean | { label: string }>, expectClose = true) {
  await page.getByTestId(`${testId}-open`).first().click();
  const form = page.getByTestId(testId);
  await expect(form).toBeVisible();
  for (const [name, v] of Object.entries(fill)) {
    const el = form.locator(`[name="${name}"]`);
    const tag = await el.evaluate((n) => n.tagName.toLowerCase());
    const type = await el.getAttribute("type");
    if (typeof v === "object") await el.selectOption({ label: v.label });
    else if (type === "checkbox") { if (v) await el.check(); else await el.uncheck(); }
    else if (tag === "select") await el.selectOption(String(v));
    else await el.fill(String(v));
  }
  await page.getByTestId(`${testId}-submit`).click();
  if (expectClose) await expect(form).toBeHidden();
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}
