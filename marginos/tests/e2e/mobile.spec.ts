import { test, expect } from "@playwright/test";
import { login, noHorizontalOverflow, today } from "./helpers";

test("Android viewport: no horizontal overflow, bottom navigation, mobile forms", async ({ page }) => {
  await login(page, "demo@marginos.app", "MarginOS-demo-2026");
  await page.waitForURL("**/dashboard");
  for (const path of ["/dashboard", "/clients", "/projects", "/production", "/scope", "/time", "/team", "/expenses", "/invoices", "/media", "/reports/clients", "/advisor", "/settings/members"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await noHorizontalOverflow(page);
  }
  // Bottom nav
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Mobile" });
  await nav.getByRole("link", { name: "Clients" }).tap();
  await page.waitForURL("**/clients");
  await page.getByTestId("mobile-more").tap();
  await page.getByRole("dialog").getByRole("link", { name: "Invoices" }).tap();
  await page.waitForURL("**/invoices");
  // A form works on a small screen (bottom sheet dialog)
  await page.goto("/time");
  await page.getByTestId("log-time-open").tap();
  const form = page.getByTestId("log-time");
  await expect(form).toBeInViewport();
  await form.locator('[name="employeeId"]').selectOption({ label: "Sameer Khan" });
  await form.locator('[name="date"]').fill(today());
  await form.locator('[name="projectId"]').selectOption({ index: 1 });
  await form.locator('[name="hours"]').fill("1.5");
  await page.getByTestId("log-time-submit").tap();
  await expect(form).toBeHidden();
  await expect(page.getByTestId("time-table")).toContainText("Sameer Khan");
  await noHorizontalOverflow(page);
});

test("mobile login page and landing have no overflow", async ({ page }) => {
  for (const path of ["/", "/login", "/signup"]) {
    await page.goto(path);
    await noHorizontalOverflow(page);
  }
});
