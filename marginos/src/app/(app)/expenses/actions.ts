"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defineAction, zBool, zDate, zId, zMoney } from "@/lib/action";
import { assertOwned } from "@/lib/owned";
import { audit } from "@/lib/audit";
import { ActionError } from "@/lib/tenant";

const saveExpenseSchema = z.object({
  id: zId.optional(), date: zDate, amount: zMoney.refine((v) => Number(v) !== 0, "Amount can't be zero"), description: z.string().trim().min(2, "Describe the expense").max(300),
  categoryId: zId, vendorId: zId.optional(), freelancerId: zId.optional(), clientId: zId.optional(), projectId: zId.optional(), deliverableId: zId.optional(),
  paymentStatus: z.enum(["PAID", "UNPAID"]).default("PAID"), recurringInterval: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]).optional(), outOfScope: zBool,
});

export const saveExpense = defineAction("MANAGE_FINANCE", saveExpenseSchema, async (ctx, v) => {
  await assertOwned(ctx.orgId, { category: v.categoryId, vendor: v.vendorId, freelancer: v.freelancerId, client: v.clientId, project: v.projectId, deliverable: v.deliverableId });
  // Resolve client from project so a cost can never be attributed to two different clients.
  let clientId = v.clientId ?? null;
  if (v.projectId) {
    const p = await db.project.findUniqueOrThrow({ where: { id: v.projectId } });
    clientId = p.clientId;
  }
  if (v.deliverableId) {
    const dl = await db.deliverable.findUniqueOrThrow({ where: { id: v.deliverableId } });
    if (!v.projectId || dl.projectId !== v.projectId) throw new ActionError("The deliverable must belong to the selected project.");
  }
  const data = {
    date: v.date, amount: v.amount, description: v.description, categoryId: v.categoryId, vendorId: v.vendorId ?? null, freelancerId: v.freelancerId ?? null,
    clientId, projectId: v.projectId ?? null, deliverableId: v.deliverableId ?? null, paymentStatus: v.paymentStatus, paidAt: v.paymentStatus === "PAID" ? v.date : null,
    isRecurring: !!v.recurringInterval, recurringInterval: v.recurringInterval ?? null, outOfScope: v.outOfScope,
  };
  if (v.id) {
    const before = await db.expense.findFirst({ where: { id: v.id, orgId: ctx.orgId } });
    if (!before) throw new ActionError("Expense not found.");
    await db.expense.update({ where: { id: v.id }, data });
    await audit(ctx, "expense.updated", "Expense", v.id, { amountFrom: before.amount.toString(), amountTo: v.amount });
    return { ok: true, message: "Expense saved" };
  }
  const e = await db.expense.create({ data: { ...data, orgId: ctx.orgId } });
  await audit(ctx, "expense.created", "Expense", e.id, { amount: v.amount, description: v.description });
  return { ok: true, message: "Expense recorded" };
});

const deleteExpenseSchema = z.object({ id: zId });

export const deleteExpense = defineAction("MANAGE_FINANCE", deleteExpenseSchema, async (ctx, { id }) => {
  const e = await db.expense.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!e) throw new ActionError("Expense not found.");
  await db.expense.delete({ where: { id } });
  await audit(ctx, "expense.deleted", "Expense", id, { amount: e.amount.toString(), description: e.description });
  return { ok: true, message: "Expense deleted" };
});

const markExpensePaidSchema = z.object({ id: zId });

export const markExpensePaid = defineAction("MANAGE_FINANCE", markExpensePaidSchema, async (ctx, { id }) => {
  const r = await db.expense.updateMany({ where: { id, orgId: ctx.orgId }, data: { paymentStatus: "PAID", paidAt: new Date() } });
  if (!r.count) throw new ActionError("Expense not found.");
  return { ok: true, message: "Marked paid" };
});

const step = (dt: Date, interval: string) => new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + (interval === "MONTHLY" ? 1 : interval === "QUARTERLY" ? 3 : 12), dt.getUTCDate()));

/** Create any missing occurrences of recurring expenses up to today. Idempotent. */
export const postRecurring = defineAction("MANAGE_FINANCE", z.object({}), async (ctx) => {
  const templates = await db.expense.findMany({ where: { orgId: ctx.orgId, isRecurring: true } });
  const today = new Date();
  let created = 0;
  for (const t of templates) {
    const existing = await db.expense.findMany({ where: { orgId: ctx.orgId, recurringSourceId: t.id }, select: { date: true } });
    const have = new Set(existing.map((e) => e.date.toISOString().slice(0, 10)));
    for (let dt = step(t.date, t.recurringInterval ?? "MONTHLY"); dt <= today; dt = step(dt, t.recurringInterval ?? "MONTHLY")) {
      if (have.has(dt.toISOString().slice(0, 10))) continue;
      await db.expense.create({ data: { orgId: ctx.orgId, date: dt, amount: t.amount, description: t.description, categoryId: t.categoryId, vendorId: t.vendorId, clientId: t.clientId, projectId: t.projectId, recurringSourceId: t.id, paymentStatus: "UNPAID" } });
      created++;
    }
  }
  if (created) await audit(ctx, "expense.recurring_posted", "Expense", null, { created });
  return { ok: true, message: created ? `Posted ${created} recurring expense${created > 1 ? "s" : ""}` : "Recurring expenses are up to date" };
});
