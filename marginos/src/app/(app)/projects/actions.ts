"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defineAction, zBool, zDate, zId, zInt, zMoneyPos, zText } from "@/lib/action";
import { assertOwned } from "@/lib/owned";
import { audit } from "@/lib/audit";
import { ActionError } from "@/lib/tenant";

const zDec = z.string().regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a number");

const saveProjectSchema = z.object({
  id: zId.optional(),
  name: z.string().trim().min(2, "Enter a project name").max(160),
  clientId: zId,
  managerId: zId.optional(),
  contractValue: zMoneyPos,
  budget: zMoneyPos,
  budgetHours: zDec.optional(),
  targetMarginPct: z.coerce.number().min(0).max(95).optional(),
  startDate: zDate.optional(),
  endDate: zDate.optional(),
  revisionLimit: zInt(0).default(2),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]),
  description: zText(2000).optional(),
  sharedWithClient: zBool,
}).refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { message: "End date must be after start date", path: ["endDate"] });

export const saveProject = defineAction("MANAGE_WORK", saveProjectSchema, async (ctx, v) => {
  await assertOwned(ctx.orgId, { client: v.clientId, employee: v.managerId });
  const { id, ...rest } = v;
  const data = { ...rest, managerId: rest.managerId ?? null, budgetHours: rest.budgetHours ?? "0", targetMarginPct: rest.targetMarginPct !== undefined ? String(rest.targetMarginPct) : null, startDate: rest.startDate ?? null, endDate: rest.endDate ?? null, description: rest.description ?? null };
  if (id) {
    const before = await db.project.findFirst({ where: { id, orgId: ctx.orgId } });
    if (!before) throw new ActionError("Project not found.");
    await db.project.update({ where: { id }, data });
    // Keep denormalised client on direct expenses consistent if the project moves client.
    if (before.clientId !== v.clientId) await db.expense.updateMany({ where: { orgId: ctx.orgId, projectId: id }, data: { clientId: v.clientId } });
    await audit(ctx, "project.updated", "Project", id, { budget: v.budget, contractValue: v.contractValue, status: v.status });
    return { ok: true, message: "Project saved" };
  }
  const p = await db.project.create({ data: { ...data, orgId: ctx.orgId } });
  await audit(ctx, "project.created", "Project", p.id, { name: p.name, contractValue: v.contractValue });
  return { ok: true, data: { id: p.id }, message: "Project created" };
});

const deleteProjectSchema = z.object({ id: zId });

export const deleteProject = defineAction("MANAGE_WORK", deleteProjectSchema, async (ctx, { id }) => {
  const p = await db.project.findFirst({ where: { id, orgId: ctx.orgId }, include: { _count: { select: { invoices: true, timeEntries: true } } } });
  if (!p) throw new ActionError("Project not found.");
  if (p._count.invoices) throw new ActionError("This project has invoices. Cancel or complete it instead of deleting.");
  await db.project.delete({ where: { id } });
  await audit(ctx, "project.deleted", "Project", id, { name: p.name, timeEntries: p._count.timeEntries });
  return { ok: true, message: "Project deleted" };
});

const deliverableSchema = z.object({
  id: zId.optional(),
  projectId: zId,
  title: z.string().trim().min(1, "Enter a title").max(200),
  type: z.enum(["REEL", "SHORT_VIDEO", "LONG_VIDEO", "PHOTOGRAPHY", "GRAPHIC_DESIGN", "BRAND_IDENTITY", "SOCIAL_POST", "AD_CREATIVE", "INFLUENCER_CAMPAIGN", "WEBSITE", "OTHER"]),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "DELIVERED"]).default("NOT_STARTED"),
  quantityContracted: zInt(0),
  quantityCompleted: zInt(0),
  revisionCount: zInt(0).default(0),
  revisionLimit: zInt(0).optional(),
  shootDays: zDec.default("0"),
  revenueAllocation: zMoneyPos.default("0"),
  dueDate: zDate.optional(),
  outOfScope: zBool,
  sharedWithClient: zBool,
});

export const saveDeliverable = defineAction("MANAGE_WORK", deliverableSchema, async (ctx, v) => {
  await assertOwned(ctx.orgId, { project: v.projectId });
  const { id, ...rest } = v;
  const data = { ...rest, revisionLimit: rest.revisionLimit ?? null, dueDate: rest.dueDate ?? null };
  if (id) {
    const r = await db.deliverable.updateMany({ where: { id, orgId: ctx.orgId }, data });
    if (!r.count) throw new ActionError("Deliverable not found.");
    return { ok: true, message: "Deliverable saved" };
  }
  await db.deliverable.create({ data: { ...data, orgId: ctx.orgId } });
  return { ok: true, message: "Deliverable added" };
});

/** Quick progress update usable by team members (no financial fields). */
const updateDeliverableProgressSchema = z.object({
  id: zId, status: z.enum(["NOT_STARTED", "IN_PROGRESS", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "DELIVERED"]), quantityCompleted: zInt(0), revisionCount: zInt(0),
  sharedWithClient: zBool,
});

export const updateDeliverableProgress = defineAction("LOG_TIME", updateDeliverableProgressSchema, async (ctx, v) => {
  const r = await db.deliverable.updateMany({ where: { id: v.id, orgId: ctx.orgId }, data: { status: v.status, quantityCompleted: v.quantityCompleted, revisionCount: v.revisionCount, sharedWithClient: v.sharedWithClient } });
  if (!r.count) throw new ActionError("Deliverable not found.");
  return { ok: true, message: "Progress updated" };
});

const deleteDeliverableSchema = z.object({ id: zId });

export const deleteDeliverable = defineAction("MANAGE_WORK", deleteDeliverableSchema, async (ctx, { id }) => {
  const r = await db.deliverable.deleteMany({ where: { id, orgId: ctx.orgId } });
  if (!r.count) throw new ActionError("Deliverable not found.");
  await audit(ctx, "deliverable.deleted", "Deliverable", id);
  return { ok: true, message: "Deliverable deleted" };
});

const saveAssignmentSchema = z.object({
  projectId: zId, employeeId: zId.optional(), freelancerId: zId.optional(), role: zText(80).optional(), allocatedHours: zDec.default("0"),
}).refine((v) => !!v.employeeId !== !!v.freelancerId, { message: "Choose either a team member or a freelancer", path: ["employeeId"] });

export const saveAssignment = defineAction("MANAGE_WORK", saveAssignmentSchema, async (ctx, v) => {
  await assertOwned(ctx.orgId, { project: v.projectId, employee: v.employeeId, freelancer: v.freelancerId });
  await db.projectAssignment.create({ data: { orgId: ctx.orgId, projectId: v.projectId, employeeId: v.employeeId ?? null, freelancerId: v.freelancerId ?? null, role: v.role ?? null, allocatedHours: v.allocatedHours } });
  return { ok: true, message: "Assigned" };
});

const deleteAssignmentSchema = z.object({ id: zId });

export const deleteAssignment = defineAction("MANAGE_WORK", deleteAssignmentSchema, async (ctx, { id }) => {
  const r = await db.projectAssignment.deleteMany({ where: { id, orgId: ctx.orgId } });
  if (!r.count) throw new ActionError("Assignment not found.");
  return { ok: true, message: "Removed from project" };
});
