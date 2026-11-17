import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { onboard, signup, submitDialog, today, uid } from "./helpers";

/**
 * The full agency journey, with hand-computed expected figures:
 *  Employee salary ₹88,000 + 12% load ÷ 176 h  → loaded rate ₹560/h
 *  20 h editing on "Hero reel"                  → labour ₹11,200
 *  Lens rental expense                           → ₹3,000
 *  Project cost                                  → ₹14,200 (budget ₹10,000 → 142%, OVER)
 *  Invoice fee ₹25,000 (+₹4,500 tax)             → revenue ₹25,000, profit ₹10,800
 *  Payment ₹10,000                               → balance ₹19,500, partially paid
 *  Projected margin (50,000 − 14,200) ÷ 50,000   → 71.6%
 */
test.describe.configure({ mode: "serial" });

test("agency journey: register → client → project → deliverables → time → expenses → revenue → profitability → scope → report → export", async ({ page }) => {
  const id = uid();
  // 1. Register an agency
  await signup(page, "Asha Founder", `founder-${id}@agency.test`);
  await onboard(page, `Journey Studio ${id}`, { employee: { name: "Ed Editor", salary: "88000" }, client: { name: "Acme Studios", value: "150000" } });
  await expect(page.getByText("Your command centre fills up as you work")).toBeVisible(); // honest empty state, no fake numbers

  // 2. Create (and edit) a client
  await page.goto("/clients");
  await submitDialog(page, "new-client", { name: "Beta Brands", contractValue: "80000", status: "ACTIVE", billingFrequency: "MONTHLY" });
  await expect(page.getByTestId("clients-table").getByText("Beta Brands").first()).toBeVisible();
  await page.getByTestId("clients-table").getByRole("link", { name: "Beta Brands" }).first().click();
  await submitDialog(page, "edit-client", { industry: "Retail", contractValue: "90000" });
  await expect(page.getByText("Retail")).toBeVisible();

  // 3. Create a project
  await page.goto("/projects");
  await submitDialog(page, "new-project", { name: "Launch Film", clientId: { label: "Acme Studios" }, contractValue: "50000", budget: "10000", budgetHours: "15", revisionLimit: "2", status: "ACTIVE" });
  await page.getByTestId("projects-table").getByRole("link", { name: "Launch Film" }).first().click();
  await page.waitForURL(/\/projects\/[a-z0-9]+$/);
  const projectUrl = page.url();

  // 4. Add deliverables (revision count already above the limit of 2)
  await submitDialog(page, "new-deliverable", { title: "Hero reel", type: "REEL", status: "IN_PROGRESS", quantityContracted: "2", quantityCompleted: "1", revisionCount: "3", revenueAllocation: "30000" });
  await submitDialog(page, "new-deliverable", { title: "Poster set", type: "GRAPHIC_DESIGN", quantityContracted: "4", quantityCompleted: "0", revenueAllocation: "20000" });
  await expect(page.getByTestId("deliverables-table").getByText("Hero reel").first()).toBeVisible();

  // 5. Assign an employee
  await submitDialog(page, "assign", { employeeId: { label: "Ed Editor" }, role: "Editor", allocatedHours: "15" });
  await expect(page.getByRole("link", { name: "Ed Editor" }).first()).toBeVisible();

  // 6. Record employee hours
  await submitDialog(page, "project-log-time", { employeeId: { label: "Ed Editor" }, date: today(), deliverableId: { label: "Hero reel" }, hours: "20", workType: "EDITING" });

  // 7. Add a production expense
  await page.goto("/expenses");
  await submitDialog(page, "new-expense", { date: today(), amount: "3000", description: "Lens rental", categoryId: { label: "Equipment rental" }, projectId: { label: "Launch Film — Acme Studios" }, deliverableId: { label: "Hero reel — Launch Film" }, paymentStatus: "PAID" });
  await expect(page.getByTestId("expenses-table").getByText("Lens rental").first()).toBeVisible();

  // 8. Record revenue: invoice → sent → partial payment
  await page.goto("/invoices");
  await submitDialog(page, "new-invoice", { clientId: { label: "Acme Studios" }, projectId: { label: "Launch Film — Acme Studios" }, subtotal: "25000", taxAmount: "4500", status: "SENT", description: "Launch film — milestone 1" });
  await page.goto("/invoices?status=outstanding");
  await page.getByTestId("invoices-table").getByRole("link").first().click();
  await submitDialog(page, "record-payment", { amount: "10000", method: "UPI" });
  await expect(page.getByTestId("invoice-balance")).toHaveText("₹19,500.00");
  await expect(page.getByText("Partially Paid").first()).toBeVisible();

  // 9. View project profitability (exact figures)
  await page.goto(projectUrl);
  const kpis = page.getByTestId("project-kpis");
  await expect(kpis).toContainText("₹25,000"); // invoiced revenue
  await expect(kpis).toContainText("₹14,200"); // actual cost
  await expect(kpis).toContainText("₹10,800"); // profit to date
  await expect(kpis).toContainText("71.6%");   // projected margin
  await expect(page.getByText("₹14,200 of ₹10,000")).toBeVisible(); // budget vs actual

  // 10. Scope creep alerts fire, then a change request is logged, quoted, approved and invoiced
  const alerts = page.getByTestId("project-alerts");
  await expect(alerts).toContainText("Hero reel: 3 revisions vs limit of 2");
  await expect(alerts).toContainText("cost is 142% of budget");
  await expect(alerts).toContainText("20.0 h logged vs 15 h budgeted");
  await submitDialog(page, "new-scope", { title: "Extra 30s cutdown", type: "ADDITIONAL_DELIVERABLE", estimatedHours: "6", estimatedCost: "3360" });
  await expect(alerts).toContainText("additional deliverable requested");
  await submitDialog(page, "quote-scope", { quotedAmount: "8000", sharedWithClient: true });
  await expect(page.getByTestId("scope-list")).toContainText("CR-0001");
  await page.getByTestId("approve-scope").click();
  await expect(page.getByTestId("scope-list")).toContainText(/approved/i);
  await page.getByTestId("invoice-scope").click();
  await page.getByTestId("invoice-scope-confirm").click();
  await expect(page.getByTestId("scope-list")).toContainText(/invoiced/i);
  await expect(kpis).toContainText("+ ₹8,000 approved changes");

  // Dashboard reflects real records
  await page.goto("/dashboard");
  await expect(page.getByTestId("kpis")).toContainText("₹25,000");
  await expect(page.getByTestId("profit-bridge")).toContainText("₹11,200"); // direct labour

  // 11. Generate a report
  await page.goto("/reports/projects");
  const report = page.getByTestId("report-table");
  await expect(report).toContainText("Launch Film");
  await expect(report).toContainText("₹14,200");

  // 12. Export the data
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download CSV" }).click()]);
  const csv = fs.readFileSync((await download.path())!, "utf8");
  expect(csv).toContain("Launch Film");
  expect(csv).toContain("14200.00");
  expect(csv.split("\r\n")[0]).toContain("Projected margin %");
});
