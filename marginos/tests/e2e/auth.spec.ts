import { test, expect } from "@playwright/test";
import { db, login, onboard, PASSWORD, signup, uid } from "./helpers";

test("signup validation: weak password, invalid email, duplicate account", async ({ page }) => {
  await page.goto("/signup");
  await page.fill("#name", "A");
  await page.fill("#email", "not-an-email");
  await page.fill("#password", "short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await expect(page.getByText("Enter a valid email")).toBeVisible();
  await expect(page.getByText("Use at least 10 characters")).toBeVisible();
  await page.fill("#name", "Dup Person");
  await page.fill("#email", "demo@marginos.app");
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("already exists")).toBeVisible();
});

test("login errors, session persistence across refresh, logout", async ({ page, context }) => {
  const email = `auth-${uid()}@agency.test`;
  await signup(page, "Auth Tester", email);
  await onboard(page, "Auth Agency");
  // persistence: refresh and new tab stay signed in
  await page.reload();
  await expect(page).toHaveURL(/dashboard/);
  const tab = await context.newPage();
  await tab.goto("/clients");
  await expect(tab.getByRole("heading", { name: "Clients" })).toBeVisible();
  await tab.close();
  // logout
  await page.getByTestId("user-menu").first().click();
  await page.getByTestId("logout").click();
  await page.waitForURL("**/login");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  // wrong password
  await login(page, email, "wrong-password-123");
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await login(page, email);
  await page.waitForURL("**/dashboard");
});

test("forgot password → email → reset → old sessions revoked → sign in with new password", async ({ page }) => {
  const email = `reset-${uid()}@agency.test`;
  await signup(page, "Reset Tester", email);
  await onboard(page, "Reset Agency");
  const sessionsBefore = await db.session.count({ where: { user: { email } } });
  expect(sessionsBefore).toBeGreaterThan(0);
  await page.context().clearCookies();
  await page.goto("/forgot-password");
  await page.fill("#email", email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists")).toBeVisible();
  // Unknown email gets the identical response (no account enumeration)
  await page.fill("#email", `nobody-${uid()}@agency.test`);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists")).toBeVisible();
  const mail = await db.outboundEmail.findFirstOrThrow({ where: { to: email }, orderBy: { createdAt: "desc" } });
  const link = mail.body.match(/http\S+\/reset-password\/\S+/)![0];
  await page.goto(new URL(link).pathname);
  await page.fill("#password", "Brand-new-pass-99");
  await page.getByRole("button", { name: "Update password" }).click();
  await page.waitForURL("**/dashboard");
  expect(await db.session.count({ where: { user: { email } } })).toBe(1); // all old sessions revoked
  // link is single-use
  await page.goto(new URL(link).pathname);
  await page.fill("#password", "Another-pass-123");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("invalid or has expired")).toBeVisible();
  await page.context().clearCookies();
  await login(page, email, "Brand-new-pass-99");
  await page.waitForURL("**/dashboard");
});

test("unauthenticated access is blocked for pages and APIs", async ({ page, request }) => {
  await page.goto("/expenses");
  await expect(page).toHaveURL(/login\?next=%2Fexpenses/);
  const res = await request.get("/api/export/clients");
  expect(res.status()).toBe(401);
  const health = await request.get("/api/health");
  expect((await health.json()).db).toBe("connected");
});
