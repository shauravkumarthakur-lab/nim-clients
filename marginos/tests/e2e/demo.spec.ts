import { test, expect } from "@playwright/test";
import { db, login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("demo workspace: populated dashboard, filters, drill-down, client intelligence", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("demo-login").click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  const kpis = page.getByTestId("kpis");
  await expect(kpis).toContainText("Revenue");
  await expect(page.getByTestId("chart-revenue-expenses")).toBeVisible();
  await expect(page.getByTestId("alerts")).toBeVisible();
  // Date filter
  await page.getByTestId("period-filter").selectOption("last_3_months");
  await page.waitForURL(/period=last_3_months/);
  await expect(page.getByText("Last 3 months").first()).toBeVisible();
  // Drill down: least-profitable client → client page
  await page.getByTestId("least-profitable").getByRole("link").first().click();
  await expect(page.getByTestId("client-kpis")).toBeVisible();
  // Margin destroyer filter
  await page.goto("/clients?period=last_3_months&filter=destroyers");
  await expect(page.getByTestId("clients-table")).toContainText("Kora Handloom Collective");
  // Production economics gives a real cost per reel
  await page.goto("/production");
  await expect(page.getByTestId("unit-costs")).toContainText("Cost of one reel");
  await expect(page.getByTestId("unit-costs")).toContainText("₹");
  // Reports + methodology
  await page.goto("/reports/monthly");
  await expect(page.getByTestId("report-table")).toContainText("Total");
});

test("AI advisor in demo mode answers from verified data and links records", async ({ page }) => {
  await login(page, "demo@marginos.app", "MarginOS-demo-2026");
  await page.waitForURL("**/dashboard");
  await page.goto("/advisor");
  await expect(page.getByTestId("advisor-mode")).toContainText("Demo mode");
  await page.getByTestId("advisor-input").fill("Which client is the least profitable?");
  await page.getByTestId("advisor-ask").click();
  const answer = page.getByTestId("advisor-answer").last();
  await expect(answer).toContainText("Kora Handloom Collective");
  await expect(answer).toContainText("Actual");
  await expect(answer.getByRole("link", { name: "Kora Handloom Collective" }).first()).toHaveAttribute("href", /\/clients\//);
  await page.getByTestId("advisor-input").fill("What happens to our margin if production costs increase by 15%?");
  await page.getByTestId("advisor-ask").click();
  await expect(page.getByTestId("advisor-answer").last()).toContainText("Estimate");
  await page.goto("/settings/integrations");
  await expect(page.getByTestId("ai-status")).toContainText("Not configured");
});

test("client portal: approve a deliverable and a change request; agency sees the result", async ({ page }) => {
  await login(page, "portal@meridian.demo", "Meridian-portal-2026");
  await page.waitForURL("**/portal");
  const cr = await db.scopeChange.findFirstOrThrow({ where: { changeRequestNo: "CR-0004" } });
  expect(cr.status).toBe("QUOTED");
  await page.getByTestId("portal-approve-cr-open").first().click();
  await page.getByTestId("portal-approve-cr-submit").click();
  await expect(page.getByTestId("portal-changes-table")).toContainText(/approved/i);
  expect((await db.scopeChange.findUniqueOrThrow({ where: { id: cr.id } })).status).toBe("APPROVED");
  const review = page.getByTestId("portal-review");
  if (await review.count()) {
    await page.getByTestId("portal-changes-open").first().click();
    await page.getByTestId("portal-changes").locator("textarea").fill("Please use the new campus logo.");
    await page.getByTestId("portal-changes-submit").click();
    await expect(page.getByText("Change request sent to the team")).toBeVisible();
    expect(await db.deliverable.count({ where: { clientFeedback: "Please use the new campus logo.", status: "CHANGES_REQUESTED" } })).toBe(1);
  }
});

test("demo reset regenerates data only inside the demo org", async ({ page }) => {
  const realOrgsBefore = await db.organization.count({ where: { isDemo: false } });
  await login(page, "demo@marginos.app", "MarginOS-demo-2026");
  await page.waitForURL("**/dashboard");
  await page.goto("/settings/demo");
  await page.getByTestId("reset-demo").click();
  await page.getByTestId("reset-demo-confirm").click();
  await expect(page.getByText("Demo data reset")).toBeVisible({ timeout: 30_000 });
  expect((await db.scopeChange.findFirstOrThrow({ where: { changeRequestNo: "CR-0004" } })).status).toBe("QUOTED");
  expect(await db.organization.count({ where: { isDemo: false } })).toBe(realOrgsBefore);
  const demo = await db.organization.findFirstOrThrow({ where: { isDemo: true } });
  expect(await db.deliverable.count({ where: { orgId: demo.id } })).toBeGreaterThanOrEqual(100);
});
