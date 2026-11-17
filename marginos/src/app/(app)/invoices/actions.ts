"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defineAction, zBool, zDate, zId, zMoney, zMoneyPos, zText } from "@/lib/action";
import { assertOwned } from "@/lib/owned";
import { audit } from "@/lib/audit";
import { ActionError } from "@/lib/tenant";
import { derivePaymentStatus } from "@/lib/finance/engine";

async function syncStatus(invoiceId: string) {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true } });
  const status = derivePaymentStatus({ ...inv }, inv.payments);
  if (status !== inv.status) await db.invoice.update({ where: { id: invoiceId }, data: { status } });
}

const saveInvoiceSchema = z.object({
  id: zId.optional(), number: z.string().trim().min(1).max(40), clientId: zId, projectId: zId.optional(), issueDate: zDate, dueDate: zDate,
  subtotal: zMoney, taxAmount: zMoneyPos.default("0"), passThrough: zMoneyPos.default("0"), status: z.enum(["DRAFT", "SENT", "VOID"]).default("DRAFT"),
  description: zText(300).optional(), sharedWithClient: zBool,
}).refine((v) => v.dueDate >= v.issueDate, { message: "Due date must be on or after the issue date", path: ["dueDate"] });

export const saveInvoice = defineAction("MANAGE_FINANCE", saveInvoiceSchema, async (ctx, v) => {
  await assertOwned(ctx.orgId, { client: v.clientId, project: v.projectId });
  if (v.projectId) {
    const p = await db.project.findUniqueOrThrow({ where: { id: v.projectId } });
    if (p.clientId !== v.clientId) throw new ActionError("That project belongs to a different client.");
  }
  const data = { number: v.number, clientId: v.clientId, projectId: v.projectId ?? null, issueDate: v.issueDate, dueDate: v.dueDate, subtotal: v.subtotal, taxAmount: v.taxAmount, passThrough: v.passThrough, description: v.description ?? null, sharedWithClient: v.sharedWithClient };
  if (v.id) {
    const before = await db.invoice.findFirst({ where: { id: v.id, orgId: ctx.orgId }, include: { _count: { select: { payments: true } } } });
    if (!before) throw new ActionError("Invoice not found.");
    if (before._count.payments && before.subtotal.toString() !== Number(v.subtotal).toFixed(2) && v.status !== "VOID") throw new ActionError("This invoice has payments. Issue a credit note instead of changing the amount.");
    await db.invoice.update({ where: { id: v.id }, data: { ...data, status: v.status === "VOID" ? "VOID" : v.status === "DRAFT" && !before._count.payments ? "DRAFT" : before.status === "DRAFT" ? "SENT" : before.status } });
    await syncStatus(v.id);
    await audit(ctx, "invoice.updated", "Invoice", v.id, { number: v.number, subtotalFrom: before.subtotal.toString(), subtotalTo: v.subtotal, status: v.status });
    return { ok: true, message: "Invoice saved" };
  }
  const inv = await db.invoice.create({ data: { ...data, status: v.status, orgId: ctx.orgId } });
  await audit(ctx, "invoice.created", "Invoice", inv.id, { number: v.number, subtotal: v.subtotal });
  return { ok: true, data: { id: inv.id }, message: `Invoice ${v.number} created` };
});

const setInvoiceStatusSchema = z.object({ id: zId, status: z.enum(["SENT", "VOID", "DRAFT"]) });

export const setInvoiceStatus = defineAction("MANAGE_FINANCE", setInvoiceStatusSchema, async (ctx, v) => {
  const inv = await db.invoice.findFirst({ where: { id: v.id, orgId: ctx.orgId }, include: { _count: { select: { payments: true } } } });
  if (!inv) throw new ActionError("Invoice not found.");
  if (v.status === "DRAFT" && inv._count.payments) throw new ActionError("Invoices with payments can't go back to draft.");
  if (v.status === "VOID" && inv._count.payments) throw new ActionError("Refund the payments before voiding this invoice.");
  await db.invoice.update({ where: { id: v.id }, data: { status: v.status } });
  if (v.status === "SENT") await syncStatus(v.id);
  await audit(ctx, `invoice.${v.status.toLowerCase()}`, "Invoice", v.id, { number: inv.number });
  return { ok: true, message: v.status === "SENT" ? "Marked as sent" : v.status === "VOID" ? "Invoice voided" : "Back to draft" };
});

const deleteInvoiceSchema = z.object({ id: zId });

export const deleteInvoice = defineAction("MANAGE_FINANCE", deleteInvoiceSchema, async (ctx, { id }) => {
  const inv = await db.invoice.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!inv) throw new ActionError("Invoice not found.");
  if (inv.status !== "DRAFT") throw new ActionError("Only drafts can be deleted. Void sent invoices so the audit trail remains.");
  await db.scopeChange.updateMany({ where: { invoiceId: id }, data: { status: "APPROVED", invoiceId: null } });
  await db.invoice.delete({ where: { id } });
  await audit(ctx, "invoice.deleted", "Invoice", id, { number: inv.number });
  return { ok: true, message: "Draft deleted" };
});

const recordPaymentSchema = z.object({
  invoiceId: zId, date: zDate, amount: zMoney.refine((v) => Number(v) !== 0, "Amount can't be zero"), method: zText(40).optional(), reference: zText(80).optional(),
});

export const recordPayment = defineAction("MANAGE_FINANCE", recordPaymentSchema, async (ctx, v) => {
  const inv = await db.invoice.findFirst({ where: { id: v.invoiceId, orgId: ctx.orgId } });
  if (!inv) throw new ActionError("Invoice not found.");
  if (inv.status === "DRAFT" || inv.status === "VOID") throw new ActionError("Mark the invoice as sent before recording payments.");
  await db.payment.create({ data: { orgId: ctx.orgId, invoiceId: inv.id, date: v.date, amount: v.amount, method: v.method ?? null, reference: v.reference ?? null } });
  await syncStatus(inv.id);
  await audit(ctx, Number(v.amount) < 0 ? "payment.refund" : "payment.recorded", "Payment", inv.id, { invoice: inv.number, amount: v.amount });
  return { ok: true, message: Number(v.amount) < 0 ? "Refund recorded" : "Payment recorded" };
});

const deletePaymentSchema = z.object({ id: zId });

export const deletePayment = defineAction("MANAGE_FINANCE", deletePaymentSchema, async (ctx, { id }) => {
  const p = await db.payment.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!p) throw new ActionError("Payment not found.");
  await db.payment.delete({ where: { id } });
  await syncStatus(p.invoiceId);
  await audit(ctx, "payment.deleted", "Payment", id, { amount: p.amount.toString() });
  return { ok: true, message: "Payment removed" };
});
