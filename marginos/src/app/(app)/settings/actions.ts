"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defineAction, zId, zText } from "@/lib/action";
import { audit } from "@/lib/audit";
import { ActionError } from "@/lib/tenant";
import { hashToken, newToken } from "@/lib/auth/crypto";
import { sendEmail } from "@/lib/email/send";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";
import { resetDemoOrg } from "@/lib/demo/seed";
import { assertOwned } from "@/lib/owned";
import { rateLimit } from "@/lib/rate-limit";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

const updateOrgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  industry: zText(60).optional(),
  currency: z.string().refine((c) => SUPPORTED_CURRENCIES.includes(c), "Unsupported currency"),
  targetMarginPct: z.coerce.number().min(0).max(95),
  utilisationTarget: z.coerce.number().min(10).max(100),
  overheadMethod: z.enum(["REVENUE_SHARE", "LABOUR_HOURS"]),
  billingModel: zText(60).optional(),
});

export const updateOrg = defineAction("MANAGE_ORG", updateOrgSchema, async (ctx, v) => {
  await db.organization.update({ where: { id: ctx.orgId }, data: { ...v, targetMarginPct: String(v.targetMarginPct), utilisationTarget: String(v.utilisationTarget) } });
  await audit(ctx, "organization.updated", "Organization", ctx.orgId, v);
  return { ok: true, message: "Settings saved" };
});

const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["ADMIN", "FINANCE", "MANAGER", "MEMBER", "CLIENT"]),
  clientId: zId.optional(),
});

export const inviteMember = defineAction("MANAGE_ORG", inviteMemberSchema, async (ctx, v) => {
  if (!rateLimit(`invite:${ctx.orgId}`, 30, 60 * 60_000).ok) throw new ActionError("Too many invitations in the last hour.");
  if (v.role === "CLIENT" && !v.clientId) throw new ActionError("Choose which client this portal user belongs to.");
  if (v.role !== "CLIENT") v.clientId = undefined;
  await assertOwned(ctx.orgId, { client: v.clientId });
  const existing = await db.membership.findFirst({ where: { orgId: ctx.orgId, user: { email: v.email } } });
  if (existing) throw new ActionError("This person is already a member of the workspace.");
  const token = newToken();
  await db.invitation.create({ data: { orgId: ctx.orgId, email: v.email, role: v.role, clientId: v.clientId ?? null, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 86_400_000), invitedBy: ctx.userId } });
  const link = `${appUrl()}/invite/${token}`;
  await sendEmail(v.email, `You're invited to ${ctx.org.name} on MarginOS`, `${ctx.user.name} invited you to join ${ctx.org.name} on MarginOS.\n\nAccept: ${link}\n\nThis link expires in 7 days.`);
  await audit(ctx, "invitation.created", "Invitation", null, { email: v.email, role: v.role });
  return { ok: true, data: { link }, message: "Invitation created" };
});

const revokeInvitationSchema = z.object({ id: zId });

export const revokeInvitation = defineAction("MANAGE_ORG", revokeInvitationSchema, async (ctx, { id }) => {
  const r = await db.invitation.deleteMany({ where: { id, orgId: ctx.orgId, acceptedAt: null } });
  if (!r.count) throw new ActionError("Invitation not found.");
  await audit(ctx, "invitation.revoked", "Invitation", id);
  return { ok: true, message: "Invitation revoked" };
});

const changeRoleSchema = z.object({ id: zId, role: z.enum(["OWNER", "ADMIN", "FINANCE", "MANAGER", "MEMBER"]) });

export const changeRole = defineAction("MANAGE_ORG", changeRoleSchema, async (ctx, v) => {
  const m = await db.membership.findFirst({ where: { id: v.id, orgId: ctx.orgId } });
  if (!m) throw new ActionError("Member not found.");
  if (m.role === "CLIENT") throw new ActionError("Client portal users can't be given internal roles. Invite them separately.");
  if (v.role === "OWNER" && ctx.role !== "OWNER") throw new ActionError("Only an owner can grant the owner role.");
  if (m.role === "OWNER" && v.role !== "OWNER") {
    const owners = await db.membership.count({ where: { orgId: ctx.orgId, role: "OWNER" } });
    if (owners <= 1) throw new ActionError("A workspace must keep at least one owner.");
  }
  await db.membership.update({ where: { id: m.id }, data: { role: v.role } });
  await audit(ctx, "membership.role_changed", "Membership", m.id, { from: m.role, to: v.role });
  return { ok: true, message: "Role updated" };
});

const removeMemberSchema = z.object({ id: zId });

export const removeMember = defineAction("MANAGE_ORG", removeMemberSchema, async (ctx, { id }) => {
  const m = await db.membership.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!m) throw new ActionError("Member not found.");
  if (m.userId === ctx.userId) throw new ActionError("You can't remove yourself.");
  if (m.role === "OWNER" && (await db.membership.count({ where: { orgId: ctx.orgId, role: "OWNER" } })) <= 1) throw new ActionError("A workspace must keep at least one owner.");
  await db.membership.delete({ where: { id } });
  await db.session.updateMany({ where: { userId: m.userId, activeOrgId: ctx.orgId }, data: { activeOrgId: null } });
  await audit(ctx, "membership.removed", "Membership", id, { role: m.role });
  return { ok: true, message: "Member removed" };
});

const saveCategorySchema = z.object({
  id: zId.optional(), name: z.string().trim().min(2).max(60),
  kind: z.enum(["FREELANCER", "PRODUCTION", "EQUIPMENT", "TRAVEL", "SOFTWARE", "OFFICE", "MARKETING", "PROFESSIONAL_FEES", "OTHER"]),
});

export const saveCategory = defineAction("MANAGE_FINANCE", saveCategorySchema, async (ctx, v) => {
  if (v.id) {
    const r = await db.expenseCategory.updateMany({ where: { id: v.id, orgId: ctx.orgId }, data: { name: v.name, kind: v.kind } });
    if (!r.count) throw new ActionError("Category not found.");
  } else await db.expenseCategory.create({ data: { orgId: ctx.orgId, name: v.name, kind: v.kind } });
  await audit(ctx, v.id ? "category.updated" : "category.created", "ExpenseCategory", v.id, v);
  return { ok: true, message: "Category saved" };
});

const deleteCategorySchema = z.object({ id: zId });

export const deleteCategory = defineAction("MANAGE_FINANCE", deleteCategorySchema, async (ctx, { id }) => {
  const c = await db.expenseCategory.findFirst({ where: { id, orgId: ctx.orgId }, include: { _count: { select: { expenses: true } } } });
  if (!c) throw new ActionError("Category not found.");
  if (c._count.expenses) throw new ActionError(`${c._count.expenses} expenses use this category. Re-categorise them first.`);
  await db.expenseCategory.delete({ where: { id } });
  return { ok: true, message: "Category deleted" };
});

const saveVendorSchema = z.object({
  id: zId.optional(), name: z.string().trim().min(2).max(120), email: z.string().email().optional(), phone: zText(40).optional(), category: zText(60).optional(),
});

export const saveVendor = defineAction("MANAGE_FINANCE", saveVendorSchema, async (ctx, v) => {
  const data = { name: v.name, email: v.email ?? null, phone: v.phone ?? null, category: v.category ?? null };
  if (v.id) {
    const r = await db.vendor.updateMany({ where: { id: v.id, orgId: ctx.orgId }, data });
    if (!r.count) throw new ActionError("Vendor not found.");
  } else await db.vendor.create({ data: { ...data, orgId: ctx.orgId } });
  return { ok: true, message: "Vendor saved" };
});

const deleteVendorSchema = z.object({ id: zId });

export const deleteVendor = defineAction("MANAGE_FINANCE", deleteVendorSchema, async (ctx, { id }) => {
  const r = await db.vendor.deleteMany({ where: { id, orgId: ctx.orgId } });
  if (!r.count) throw new ActionError("Vendor not found.");
  return { ok: true, message: "Vendor deleted" };
});

const resetDemoSchema = z.object({ confirm: z.literal("RESET") });

export const resetDemo = defineAction("MANAGE_ORG", resetDemoSchema, async (ctx) => {
  if (!ctx.org.isDemo) throw new ActionError("Only the demo organisation can be reset. Real workspaces are never wiped.");
  if (!rateLimit(`demo-reset:${ctx.orgId}`, 5, 10 * 60_000).ok) throw new ActionError("Demo was reset recently. Try again in a few minutes.");
  const s = await resetDemoOrg(db, ctx.orgId);
  await audit(ctx, "demo.reset", "Organization", ctx.orgId, { deliverables: s.deliverables, timeEntries: s.timeEntries });
  return { ok: true, message: "Demo data reset" };
});
