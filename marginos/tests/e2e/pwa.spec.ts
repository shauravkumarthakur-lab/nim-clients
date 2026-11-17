import { test, expect, chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { login } from "./helpers";

test("PWA manifest, icons and service worker are served correctly", async ({ request }) => {
  const m = await request.get("/manifest.webmanifest");
  expect(m.ok()).toBeTruthy();
  const manifest = await m.json();
  expect(manifest.name).toContain("MarginOS");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/dashboard?source=pwa");
  expect(manifest.icons.some((i: { sizes: string; purpose: string }) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBeTruthy();
  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBeTruthy();
  expect(sw.headers()["cache-control"]).toContain("no-cache");
});

test("Chrome reports the app as installable (no installability errors)", async ({ baseURL }) => {
  // Installability isn't evaluated in incognito contexts, so use a persistent profile.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mos-pwa-"));
  const ctx = await chromium.launchPersistentContext(dir, { headless: true, executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
  try {
    const page = await ctx.newPage();
    await page.goto(`${baseURL}/login`);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    const cdp = await ctx.newCDPSession(page);
    const { url, errors: manifestErrors } = await cdp.send("Page.getAppManifest"); // makes Chrome fetch + parse the manifest
    expect(url).toContain("/manifest.webmanifest");
    expect(manifestErrors).toEqual([]);
    let errors: { errorId: string }[] = [];
    for (let i = 0; i < 10; i++) {
      errors = (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors;
      if (!errors.length) break;
      await page.waitForTimeout(500);
    }
    expect(errors).toEqual([]);
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()))).toBe(true);
  } finally {
    await ctx.close();
  }
});

test("offline fallback page is shown when the network is unavailable; data is not cached", async ({ page, context }) => {
  await login(page, "demo@marginos.app", "MarginOS-demo-2026");
  await page.waitForURL("**/dashboard");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.goto("/clients").catch(() => undefined);
  await expect(page.getByText("You're offline")).toBeVisible();
  await context.setOffline(false);
});

test("security headers are present", async ({ request }) => {
  const r = await request.get("/login");
  expect(r.headers()["x-frame-options"]).toBe("DENY");
  expect(r.headers()["x-content-type-options"]).toBe("nosniff");
  expect(r.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(r.headers()["x-powered-by"]).toBeUndefined();
});
