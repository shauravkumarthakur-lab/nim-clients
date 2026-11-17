"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defineAction, zBool, zDate, zId, zMoneyPos, zText } from "@/lib/action";
import { audit } from "@/lib/audit";
import { ActionError } from "@/lib/tenant";

const zDec = z.string().regex(/^\d{1,4}(\.\d{1,2})?$/, "Enter a number");

const saveEmployeeSchema = z.object({
  id: zId.optional(), name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().optional(),
  department: z.string().min(1).max(60), designation: z.string().trim().min(1).max(80),
  monthlySalary: zMoneyPos.refine((v) => Number(v) > 0, "Enter the monthly salary"), benefitsLoadPct: zDec.default("0"),
  monthlyHours: zDec.refine((v) => Number(v) > 0 && Number(v) <= 400, "Between 1 and 400"), joinedOn: zDate.optional(), leftOn: zDate.optional(), active: zBool,
}).refine((v) => !v.joinedOn || !v.leftOn || v.leftOn >= v.joinedOn, { message: "Must be after joining date", path: ["leftOn"] });

export const saveEmployee = defineAction("MANAGE_TEAM", saveEmployeeSchema, async (ctx, v) => {
  const { id, ...rest } = v;
  const data = { ...rest, email: rest.email ?? null, joinedOn: rest.joinedOn ?? null, leftOn: rest.leftOn ?? null };
  if (id) {
    const before = await db.employee.findFirst({ where: { id, orgId: ctx.orgId } });
    if (!before) throw new ActionError("Team member not found.");
    await db.employee.update({ where: { id }, data });
    // Salary changes are sensitive: always audited. Past time entries keep their snapshot cost rate.
    await audit(ctx, "employee.updated", "Employee", id, { salaryFrom: before.monthlySalary.toString(), salaryTo: v.monthlySalary, active: v.active });
    return { ok: true, message: "Saved. New rate applies to time logged from now on." };
  }
  const e = await db.employee.create({ data: { ...data, orgId: ctx.orgId } });
  await audit(ctx, "employee.created", "Employee", e.id, { name: e.name });
  return { ok: true, message: "Team member added" };
});

const deleteEmployeeSchema = z.object({ id: zId });

export const deleteEmployee = defineAction("MANAGE_TEAM", deleteEmployeeSchema, async (ctx, { id }) => {
  const e = await db.employee.findFirst({ where: { id, orgId: ctx.orgId }, include: { _count: { select: { timeEntries: true } } } });
  if (!e) throw new ActionError("Team member not found.");
  if (e._count.timeEntries) throw new ActionError("This person has logged time. Set a last working day and mark them inactive instead, so project costs stay intact.");
  await db.employee.delete({ where: { id } });
  await audit(ctx, "employee.deleted", "Employee", id, { name: e.name });
  return { ok: true, message: "Deleted" };
});

const saveFreelancerSchema = z.object({
  id: zId.optional(), name: z.string().trim().min(2).max(120), skill: z.string().trim().min(1).max(80), email: z.string().email().optional(), phone: zText(40).optional(),
  rateType: z.enum(["HOURLY", "FIXED"]), rate: zMoneyPos, active: zBool,
});

export const saveFreelancer = defineAction("MANAGE_TEAM", saveFreelancerSchema, async (ctx, v) => {
  const { id, ...rest } = v;
  const data = { ...rest, email: rest.email ?? null, phone: rest.phone ?? null };
  if (id) {
    const r = await db.freelancer.updateMany({ where: { id, orgId: ctx.orgId }, data });
    if (!r.count) throw new ActionError("Freelancer not found.");
  } else await db.freelancer.create({ data: { ...data, orgId: ctx.orgId } });
  return { ok: true, message: "Freelancer saved" };
});

const deleteFreelancerSchema = z.object({ id: zId });

export const deleteFreelancer = defineAction("MANAGE_TEAM", deleteFreelancerSchema, async (ctx, { id }) => {
  const f = await db.freelancer.findFirst({ where: { id, orgId: ctx.orgId }, include: { _count: { select: { expenses: true } } } });
  if (!f) throw new ActionError("Freelancer not found.");
  if (f._count.expenses) throw new ActionError("This freelancer has recorded payments. Mark them inactive instead.");
  await db.freelancer.delete({ where: { id } });
  return { ok: true, message: "Deleted" };
});
