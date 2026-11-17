"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defineAction, zBool, zDate, zId, zMoneyPos, zText } from "@/lib/action";
import { assertOwned } from "@/lib/owned";
import { audit } from "@/lib/audit";
import { ActionError } from "@/lib/tenant";
import { nextChangeRequestNumber, nextInvoiceNumber } from "@/lib/numbering";

const TYPES = ["ADDITIONAL_DELIVERABLE", "EXTRA_REVISION", "SCOPE_CHANGE", "EXTRA_SHOOT_DAY", "EXTRA_EDITING", "UNPLANNED_WORK", "OUT_OF_CONTRACT"] as const;
const zDec = z.string().regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a number");

const saveScopeChangeSchema = z.object({
  id: zId.optional(), projectId: zId, deliverableId: zId.optional(), type: z.enum(TYPES),
  title: z.string().trim().min(2, "Describe the request").max(200), description: zText(2000).optional(),
  requestedAt: zDate, requestedBy: zText(120).optional(), estimatedHours: zDec.default("0"), estimatedCost: zMoneyPos.default("0"),
});

export const saveScopeChange = defineAction("MANAGE_WORK", saveScopeChangeSchema, async (ctx, v) => {
  await assertOwned(ctx.orgId, { project: v.projectId, deliverable: v.deliverableId });
  const { id, ...rest } = v;
  const data = { ...rest, deliverableId: rest.deliverableId ?? null, description: rest.description ?? null, requestedBy: rest.requestedBy ?? null };
  if (id) {
    const r = await db.scopeChange.updateMany({ where: { id, orgId: ctx.orgId }, data });
    if (!r.count) throw new ActionError("Scope change not found.");
  } else {
    const s = await db.scopeChange.create({ data: { ...data, orgId: ctx.orgId } });
    await audit(ctx, "scope.logged", "ScopeChange", s.id, { type: v.type, estimatedCost: v.estimatedCost });
  }
  return { ok: true, message: "Scope change logged" };
});

/** Turn a logged request into a change request / additional quotation. */
const quoteScopeChangeSchema = z.object({ id: zId, quotedAmount: zMoneyPos.refine((x) => Number(x) > 0, "Enter the quoted amount"), sharedWithClient: zBool });

export const quoteScopeChange = defineAction("MANAGE_WORK", quoteScopeChangeSchema, async (ctx, v) => {
  const s = await db.scopeChange.findFirst({ where: { id: v.id, orgId: ctx.orgId } });
  if (!s) throw new ActionError("Scope change not found.");
  if (!["LOGGED", "QUOTED", "REJECTED"].includes(s.status)) throw new ActionError(`Can't quote a change that is ${s.status.toLowerCase()}.`);
  const no = s.changeRequestNo ?? (await nextChangeRequestNumber(ctx.orgId));
  await db.scopeChange.update({ where: { id: s.id }, data: { quotedAmount: v.quotedAmount, status: "QUOTED", changeRequestNo: no, sharedWithClient: v.sharedWithClient } });
  await audit(ctx, "scope.quoted", "ScopeChange", s.id, { quotedAmount: v.quotedAmount, changeRequestNo: no });
  return { ok: true, message: `Change request ${no} created` };
});

const setScopeStatusSchema = z.object({ id: zId, status: z.enum(["APPROVED", "REJECTED", "ABSORBED", "LOGGED"]) });

export const setScopeStatus = defineAction("MANAGE_WORK", setScopeStatusSchema, async (ctx, v) => {
  const s = await db.scopeChange.findFirst({ where: { id: v.id, orgId: ctx.orgId } });
  if (!s) throw new ActionError("Scope change not found.");
  if (s.status === "INVOICED") throw new ActionError("This change has already been invoiced.");
  if (v.status === "APPROVED" && !s.quotedAmount) throw new ActionError("Quote the change before marking it approved.");
  await db.scopeChange.update({ where: { id: s.id }, data: { status: v.status } });
  await audit(ctx, `scope.${v.status.toLowerCase()}`, "ScopeChange", s.id);
  return { ok: true, message: `Marked ${v.status.toLowerCase()}` };
});

/** Creates a DRAFT invoice for an approved change. Requires explicit confirmation in the UI. */
const invoiceScopeChangeSchema = z.object({ id: zId });

export const invoiceScopeChange = defineAction("MANAGE_FINANCE", invoiceScopeChangeSchema, async (ctx, { id }) => {
  const s = await db.scopeChange.findFirst({ where: { id, orgId: ctx.orgId }, include: { project: true } });
  if (!s) throw new ActionError("Scope change not found.");
  if (s.status !== "APPROVED" || !s.quotedAmount) throw new ActionError("Only approved, quoted changes can be invoiced.");
  const number = await nextInvoiceNumber(ctx.orgId);
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const inv = await db.$transaction(async (tx) => {
    const i = await tx.invoice.create({ data: { orgId: ctx.orgId, clientId: s.project.clientId, projectId: s.projectId, number, description: `${s.changeRequestNo ?? "Change request"}: ${s.title}`, issueDate: today, dueDate: new Date(today.getTime() + 15 * 86_400_000), subtotal: s.quotedAmount!, taxAmount: s.quotedAmount!.mul(0.18).toDecimalPlaces(2), status: "DRAFT" } });
    await tx.scopeChange.update({ where: { id }, data: { status: "INVOICED", invoiceId: i.id } });
    return i;
  });
  await audit(ctx, "scope.invoiced", "ScopeChange", id, { invoice: number, amount: s.quotedAmount.toString() });
  return { ok: true, message: `Draft invoice ${inv.number} created`, data: { invoiceId: inv.id } };
});

const deleteScopeChangeSchema = z.object({ id: zId });

export const deleteScopeChange = defineAction("MANAGE_WORK", deleteScopeChangeSchema, async (ctx, { id }) => {
  const r = await db.scopeChange.deleteMany({ where: { id, orgId: ctx.orgId, status: { not: "INVOICED" } } });
  if (!r.count) throw new ActionError("Scope change not found or already invoiced.");
  return { ok: true, message: "Deleted" };
});
