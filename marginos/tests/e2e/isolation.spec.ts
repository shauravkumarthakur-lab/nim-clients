import { test, expect, type Browser } from "@playwright/test";
import { db, onboard, signup, uid } from "./helpers";

async function newAgency(browser: Browser, label: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const email = `${label}-${uid()}@agency.test`.toLowerCase();
  await signup(page, `${label} Owner`, email);
  await onboard(page, `${label} Agency`, { client: { name: `${label} Secret Client`, value: "123456" } });
  return { ctx, page, email };
}

test("one agency cannot read, export, reference or modify another agency's data", async ({ browser }) => {
  const A = await newAgency(browser, "Alpha");
  const B = await newAgency(browser, "Bravo");
  const orgA = await db.organization.findFirstOrThrow({ where: { memberships: { some: { user: { email: A.email } } } } });
  const clientA = await db.client.findFirstOrThrow({ where: { orgId: orgA.id } });

  // A can see its own client
  await A.page.goto(`/clients/${clientA.id}`);
  await expect(A.page.getByRole("heading", { name: /Alpha Secret Client/ })).toBeVisible();

  // B cannot open A's client by URL (404, nothing leaked)
  const res = await B.page.goto(`/clients/${clientA.id}`);
  expect(res?.status()).toBe(404);
  await expect(B.page.getByText("Alpha Secret Client")).toHaveCount(0);

  // B's lists and exports never include A's data
  await B.page.goto("/clients");
  await expect(B.page.getByText("Alpha Secret Client")).toHaveCount(0);
  const csv = await (await B.page.request.get("/api/export/clients")).text();
  expect(csv).toContain("Bravo Secret Client");
  expect(csv).not.toContain("Alpha Secret Client");

  // B tampers with a form to reference A's client id → rejected server-side
  await B.page.goto("/projects");
  await B.page.getByTestId("new-project-open").click();
  await B.page.fill("#f-name", "Hijack attempt");
  await B.page.evaluate((id) => {
    const sel = document.querySelector<HTMLSelectElement>("#f-clientId")!;
    const o = document.createElement("option");
    o.value = id; o.text = "tampered";
    sel.appendChild(o); sel.value = id;
  }, clientA.id);
  await B.page.fill("#f-contractValue", "1000");
  await B.page.fill("#f-budget", "500");
  await B.page.getByTestId("new-project-submit").click();
  await expect(B.page.getByText("Selected client was not found.")).toBeVisible();
  expect(await db.project.count({ where: { name: "Hijack attempt" } })).toBe(0);

  // B tampers with an edit form to target A's client id → no rows changed
  await B.page.goto("/clients");
  await B.page.getByTestId("clients-table").getByRole("link", { name: "Bravo Secret Client" }).first().click();
  await B.page.getByTestId("edit-client-open").click();
  await B.page.evaluate((id) => { (document.querySelector('[data-testid="edit-client"] input[name="id"]') as HTMLInputElement).value = id; }, clientA.id);
  await B.page.fill("#f-name", "Overwritten by Bravo");
  await B.page.getByTestId("edit-client-submit").click();
  await expect(B.page.getByText("Client not found.")).toBeVisible();
  expect((await db.client.findUniqueOrThrow({ where: { id: clientA.id } })).name).toBe("Alpha Secret Client");

  // Demo org data is never visible to a real workspace
  await B.page.goto("/clients");
  await expect(B.page.getByText("Meridian Institute of Technology")).toHaveCount(0);
  await A.ctx.close(); await B.ctx.close();
});
