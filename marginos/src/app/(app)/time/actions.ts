"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { defineAction, zBool, zDate, zHours, zId, zText } from "@/lib/action";
import { assertOwned } from "@/lib/owned";
import { ActionError, type Ctx } from "@/lib/tenant";
import { loadedHourlyCost } from "@/lib/finance/engine";

const WT = ["PLANNING", "SHOOT", "PRODUCTION", "EDITING", "DESIGN", "REVISION", "ACCOUNT_MANAGEMENT", "OTHER"] as const;

/** Team members can only log time for their own employee profile (matched by email). */
async function resolveEmployee(ctx: Ctx, employeeId?: string) {
  if (can(ctx.role, "MANAGE_WORK") || can(ctx.role, "MANAGE_FINANCE")) {
    if (!employeeId) throw new ActionError("Choose a team member.");
    return employeeId;
  }
  const me = await db.employee.findFirst({ where: { orgId: ctx.orgId, email: ctx.user.email } });
  if (!me) throw new ActionError("Your login isn't linked to an employee profile. Ask an admin to set your email on your team profile.");
  return me.id;
}

const saveTimeEntrySchema = z.object({
  id: zId.optional(), employeeId: zId.optional(), projectId: zId, deliverableId: zId.optional(), date: zDate,
  hours: zHours.refine((h) => Number(h) <= 24, "Max 24 hours per entry"), workType: z.enum(WT), billable: zBool, outOfScope: zBool, notes: zText(500).optional(),
}).refine((v) => v.date <= new Date(Date.now() + 86_400_000), { message: "Time can't be logged in the future", path: ["date"] });

export const saveTimeEntry = defineAction("LOG_TIME", saveTimeEntrySchema, async (ctx, v) => {
  const employeeId = await resolveEmployee(ctx, v.employeeId);
  await assertOwned(ctx.orgId, { employee: employeeId, project: v.projectId, deliverable: v.deliverableId });
  if (v.deliverableId) {
    const dl = await db.deliverable.findUnique({ where: { id: v.deliverableId } });
    if (dl?.projectId !== v.projectId) throw new ActionError("That deliverable belongs to a different project.");
  }
  const emp = await db.employee.findUniqueOrThrow({ where: { id: employeeId } });
  const costRate = loadedHourlyCost({ id: emp.id, monthlySalary: emp.monthlySalary, benefitsLoadPct: emp.benefitsLoadPct, monthlyHours: emp.monthlyHours }).toFixed(2);
  const data = { employeeId, projectId: v.projectId, deliverableId: v.deliverableId ?? null, date: v.date, hours: v.hours, workType: v.workType, billable: v.billable, outOfScope: v.outOfScope, notes: v.notes ?? null };
  if (v.id) {
    const existing = await db.timeEntry.findFirst({ where: { id: v.id, orgId: ctx.orgId } });
    if (!existing) throw new ActionError("Time entry not found.");
    if (!can(ctx.role, "MANAGE_WORK") && existing.employeeId !== employeeId) throw new ActionError("You can only edit your own time.");
    // Keep the original cost-rate snapshot unless the employee changed.
    await db.timeEntry.update({ where: { id: v.id }, data: { ...data, costRate: existing.employeeId === employeeId ? existing.costRate : costRate } });
    return { ok: true, message: "Time updated" };
  }
  await db.timeEntry.create({ data: { ...data, costRate, orgId: ctx.orgId } });
  return { ok: true, message: `${v.hours} h logged` };
});

const deleteTimeEntrySchema = z.object({ id: zId });

export const deleteTimeEntry = defineAction("LOG_TIME", deleteTimeEntrySchema, async (ctx, { id }) => {
  const t = await db.timeEntry.findFirst({ where: { id, orgId: ctx.orgId }, include: { employee: true } });
  if (!t) throw new ActionError("Time entry not found.");
  if (!can(ctx.role, "MANAGE_WORK") && t.employee.email !== ctx.user.email) throw new ActionError("You can only delete your own time.");
  await db.timeEntry.delete({ where: { id } });
  return { ok: true, message: "Time entry deleted" };
});
