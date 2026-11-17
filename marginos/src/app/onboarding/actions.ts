"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, setActiveOrg } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { DEFAULT_EXPENSE_CATEGORIES, SUPPORTED_CURRENCIES } from "@/lib/constants";

const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount");
const schema = z.object({
  name: z.string().trim().min(2, "Enter your agency name").max(120),
  industry: z.string().max(60),
  employeeCount: z.string().max(20),
  currency: z.string().refine((c) => SUPPORTED_CURRENCIES.includes(c), "Unsupported currency"),
  revenueRange: z.string().max(60),
  billingModel: z.string().max(60),
  team: z.array(z.object({ name: z.string().trim().min(1).max(100), designation: z.string().max(80), department: z.string().max(60), monthlySalary: money })).max(100),
  categories: z.array(z.string()).max(30),
  customCategories: z.array(z.string().trim().min(1).max(60)).max(20),
  clients: z.array(z.object({ name: z.string().trim().min(1).max(120), contractValue: money.or(z.literal("")) })).max(100),
});
export type OnboardingInput = z.infer<typeof schema>;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "agency";

export async function completeOnboarding(input: OnboardingInput): Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session expired. Sign in again." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".")] ??= i.message;
    return { ok: false, error: "Please check your answers.", fieldErrors: fe };
  }
  const v = parsed.data;
  // Existing owner membership whose onboarding is incomplete → update that org; otherwise create.
  const existing = await db.membership.findFirst({ where: { userId: session.userId, role: "OWNER", org: { onboardingCompleted: false } } });
  const orgId = await db.$transaction(async (tx) => {
    const base = slugify(v.name);
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const data = { name: v.name, industry: v.industry, employeeCount: v.employeeCount, currency: v.currency, revenueRange: v.revenueRange, billingModel: v.billingModel, onboardingCompleted: true };
    const org = existing
      ? await tx.organization.update({ where: { id: existing.orgId }, data })
      : await tx.organization.create({ data: { ...data, slug } });
    if (!existing) await tx.membership.create({ data: { userId: session.userId, orgId: org.id, role: "OWNER" } });
    const names = new Map<string, (typeof DEFAULT_EXPENSE_CATEGORIES)[number]>();
    for (const c of DEFAULT_EXPENSE_CATEGORIES) if (v.categories.includes(c.name)) names.set(c.name, c);
    for (const c of v.customCategories) if (!names.has(c)) names.set(c, { name: c, kind: "OTHER" });
    // Always keep a fallback category so expenses can be recorded.
    if (!names.size) names.set("Miscellaneous", { name: "Miscellaneous", kind: "OTHER" });
    for (const c of names.values())
      await tx.expenseCategory.upsert({ where: { orgId_name: { orgId: org.id, name: c.name } }, create: { orgId: org.id, name: c.name, kind: c.kind }, update: {} });
    for (const t of v.team)
      await tx.employee.create({ data: { orgId: org.id, name: t.name, designation: t.designation || "Team member", department: t.department || "Creative", monthlySalary: t.monthlySalary, benefitsLoadPct: 12, monthlyHours: 176, joinedOn: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)) } });
    for (const c of v.clients)
      await tx.client.create({ data: { orgId: org.id, name: c.name, contractValue: c.contractValue || "0", billingFrequency: "MONTHLY", status: "ACTIVE", contractStart: new Date() } });
    return org.id;
  });
  await setActiveOrg(session.id, orgId);
  await audit({ orgId, userId: session.userId }, "organization.onboarded", "Organization", orgId, { team: v.team.length, clients: v.clients.length });
  return { ok: true };
}
