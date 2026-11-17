import { test, expect } from "@playwright/test";
import { onboard, signup, submitDialog, today, uid } from "./helpers";

test("invalid inputs are rejected server-side with field errors; CSV import is all-or-nothing; API errors are typed", async ({ page }) => {
  await signup(page, "Val Owner", `val-${uid()}@agency.test`);
  await onboard(page, "Validation Agency", { client: { name: "Val Client", value: "10000" } });

  // Expense: zero amount and bad decimal are rejected
  await page.goto("/expenses");
  await page.getByTestId("new-expense-open").click();
  const form = page.getByTestId("new-expense");
  await form.locator('[name="amount"]').fill("0");
  await form.locator('[name="description"]').fill("x");
  await form.locator('[name="date"]').fill(today());
  await page.getByTestId("new-expense-submit").click();
  await expect(form.getByText("Amount can't be zero")).toBeVisible();
  await expect(form.getByText("Describe the expense")).toBeVisible();
  await form.locator('[name="amount"]').fill("12.345");
  await page.getByTestId("new-expense-submit").click();
  await expect(form.getByText("Enter an amount with up to 2 decimals")).toBeVisible();
  await page.keyboard.press("Escape");

  // Invoice: due date before issue date
  await page.goto("/invoices");
  await page.getByTestId("new-invoice-open").click();
  const inv = page.getByTestId("new-invoice");
  await inv.locator('[name="clientId"]').selectOption({ label: "Val Client" });
  await inv.locator('[name="subtotal"]').fill("1000");
  await inv.locator('[name="issueDate"]').fill("2026-10-10");
  await inv.locator('[name="dueDate"]').fill("2026-10-01");
  await page.getByTestId("new-invoice-submit").click();
  await expect(inv.getByText("Due date must be on or after the issue date")).toBeVisible();
  await page.keyboard.press("Escape");

  // Client creation still works after rejected submissions
  await page.goto("/clients");
  await submitDialog(page, "new-client", { name: "Second Client", status: "ACTIVE", billingFrequency: "MONTHLY" });
  await expect(page.getByTestId("clients-table")).toContainText("Second Client");

  // CSV import: one bad row → nothing imported (422); fixed file → imported
  const bad = "date,amount,description,category\n2026-10-01,1500,Kit hire,Equipment rental\n2026-13-45,abc,,Unknown cat\n";
  const r1 = await page.request.post("/api/import/expenses", { data: bad, headers: { "content-type": "text/csv" } });
  expect(r1.status()).toBe(422);
  expect((await r1.json()).errors[0]).toContain("Row 3");
  const good = "date,amount,description,category,client\n2026-10-01,1500,Kit hire,Equipment rental,Val Client\n2026-10-02,-200,Refund,Equipment rental,\n";
  const r2 = await page.request.post("/api/import/expenses", { data: good, headers: { "content-type": "text/csv" } });
  expect(r2.status()).toBe(200);
  expect((await r2.json()).created).toBe(2);
  await page.goto("/expenses?period=custom&from=2026-10-01&to=2026-10-31");
  await expect(page.getByTestId("expenses-table")).toContainText("Kit hire");
  await expect(page.getByTestId("expenses-table")).toContainText("−₹200");

  // Typed API errors
  expect((await page.request.get("/api/export/does-not-exist")).status()).toBe(404);
  expect((await page.request.post("/api/import/unknown", { data: "a" })).status()).toBe(404);
  expect((await page.request.post("/api/import/expenses", { data: "", headers: { "content-type": "text/csv" } })).status()).toBe(400);
  const missing = await page.goto("/projects/not-a-real-id");
  expect(missing?.status()).toBe(404);
});
