"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defineAction, zDate, zId } from "@/lib/action";
import { assertOwned } from "@/lib/owned";
import { audit } from "@/lib/audit";
import { invoiceBalance, invoiceTotal, derivePaymentStatus } from "@/lib/finance/engine";
import { deliverableLabel } from "@/lib/constants";

/**
 * Share a delivery report with a client portal. The snapshot contains ONLY
 * client-safe information: progress, deliverables, approved changes and invoices.
 * Internal costs, salaries and margins are never included.
 */
const shareClientReportSchema = z.object({ clientId: zId, title: z.string().trim().min(3).max(160), from: zDate, to: zDate })
  .refine((v) => v.to >= v.from, { message: "End must be after start", path: ["to"] });

export const shareClientReport = defineAction("MANAGE_ORG", shareClientReportSchema, async (ctx, v) => {
  await assertOwned(ctx.orgId, { client: v.clientId });
  const to = new Date(v.to.getTime() + 86_400_000);
  const projects = await db.project.findMany({ where: { orgId: ctx.orgId, clientId: v.clientId, sharedWithClient: true }, include: { deliverables: true, scopeChanges: { where: { status: { in: ["APPROVED", "INVOICED"] } } } } });
  const invoices = await db.invoice.findMany({ where: { orgId: ctx.orgId, clientId: v.clientId, sharedWithClient: true, status: { notIn: ["DRAFT", "VOID"] }, issueDate: { gte: v.from, lt: to } }, include: { payments: true } });
  const payload = {
    projects: projects.map((p) => ({
      name: p.name, status: p.status,
      deliverables: p.deliverables.filter((x) => x.dueDate && x.dueDate >= v.from && x.dueDate < to).map((x) => ({ title: x.title, type: deliverableLabel(x.type), status: x.status, completed: x.quantityCompleted, contracted: x.quantityContracted })),
      approvedChanges: p.scopeChanges.map((s) => ({ ref: s.changeRequestNo, title: s.title, amount: s.quotedAmount?.toString() ?? null })),
    })),
    invoices: invoices.map((i) => ({ number: i.number, issueDate: i.issueDate.toISOString().slice(0, 10), total: invoiceTotal({ ...i }).toFixed(2), balance: invoiceBalance({ ...i }, i.payments).toFixed(2), status: derivePaymentStatus({ ...i }, i.payments) })),
  };
  const r = await db.sharedReport.create({ data: { orgId: ctx.orgId, clientId: v.clientId, title: v.title, periodFrom: v.from, periodTo: v.to, payload } });
  await audit(ctx, "report.shared", "SharedReport", r.id, { clientId: v.clientId });
  return { ok: true, message: "Report shared with the client portal" };
});
