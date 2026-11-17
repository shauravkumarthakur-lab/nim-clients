import { test, expect } from "@playwright/test";
import { onboard, signup, submitDialog, uid, PASSWORD, login } from "./helpers";

test("role-based access: invited team member logs time but cannot see financials or settings", async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await signup(owner, "Role Owner", `roles-${uid()}@agency.test`);
  await onboard(owner, "Roles Agency", { client: { name: "Role Client", value: "50000" } });
  const memberEmail = `member-${uid()}@agency.test`;
  await owner.goto("/settings/members");
  await submitDialog(owner, "invite-member", { email: memberEmail, role: "MEMBER" }, false);
  const link = await owner.getByTestId("invite-member-link").locator("input").inputValue();
  expect(link).toContain("/invite/");

  const memberCtx = await browser.newContext();
  const member = await memberCtx.newPage();
  await member.goto(new URL(link).pathname);
  await member.fill("#name", "Mira Member");
  await member.fill("#password", PASSWORD);
  await member.getByRole("button", { name: "Accept invitation" }).click();
  await member.waitForURL("**/time");
  await expect(member.getByRole("heading", { name: "Time tracking" })).toBeVisible();
  await expect(member.getByRole("link", { name: "Expenses" })).toHaveCount(0);
  for (const path of ["/expenses", "/invoices", "/settings", "/clients", "/team", "/advisor"]) {
    await member.goto(path);
    await expect(member, `member must not access ${path}`).toHaveURL(/forbidden/);
  }
  const res = await member.request.get("/api/export/expenses");
  expect(res.status()).toBe(403);

  // Owner sees the member and can change their role; audit log records it
  await owner.goto("/settings/members");
  await expect(owner.getByTestId("members-table")).toContainText(memberEmail);
  await owner.goto("/settings/audit");
  await expect(owner.getByTestId("audit-table")).toContainText("invitation.accepted");
  await ownerCtx.close(); await memberCtx.close();
});

test("client portal user only sees their own shared data", async ({ page }) => {
  await login(page, "portal@meridian.demo", "Meridian-portal-2026");
  await page.waitForURL("**/portal");
  await expect(page.getByTestId("portal-home")).toBeVisible();
  await expect(page.getByText("Campus Life — Social Retainer").first()).toBeVisible();
  await expect(page.getByText("Velocity")).toHaveCount(0);
  await expect(page.getByText("Saanjh")).toHaveCount(0);
  await expect(page.getByText(/contribution|salary|cost to serve|net profit/i)).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/portal/);
  expect((await page.request.get("/api/export/clients")).status()).toBe(403);
});
