"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defineAction, zDate, zId, zMoneyPos, zText } from "@/lib/action";
import { assertOwned } from "@/lib/owned";
import { audit } from "@/lib/audit";
import { ActionError } from "@/lib/tenant";

const clientSchema = z.object({
  id: zId.optional(),
  name: z.string().trim().min(2, "Enter the client name").max(120),
  company: zText(160).optional(),
  industry: zText(80).optional(),
  contactName: zText(120).optional(),
  email: z.string().email("Enter a valid email").max(200).optional(),
  phone: zText(40).optional(),
  address: zText(300).optional(),
  contractValue: zMoneyPos.default("0"),
  billingFrequency: z.enum(["MONTHLY", "QUARTERLY", "MILESTONE", "ONE_TIME", "ANNUAL"]).default("MONTHLY"),
  contractStart: zDate.optional(),
  contractEnd: zDate.optional(),
  accountManagerId: zId.optional(),
  status: z.enum(["ACTIVE", "PAUSED", "CHURNED", "PROSPECT"]).default("ACTIVE"),
  notes: zText(2000).optional(),
}).refine((v) => !v.contractStart || !v.contractEnd || v.contractEnd >= v.contractStart, { message: "End date must be after start date", path: ["contractEnd"] });

export const saveClient = defineAction("MANAGE_WORK", clientSchema, async (ctx, v) => {
  await assertOwned(ctx.orgId, { employee: v.accountManagerId });
  const { id, ...data } = v;
  const full = { ...data, company: data.company ?? null, industry: data.industry ?? null, contactName: data.contactName ?? null, email: data.email ?? null, phone: data.phone ?? null, address: data.address ?? null, contractStart: data.contractStart ?? null, contractEnd: data.contractEnd ?? null, accountManagerId: data.accountManagerId ?? null, notes: data.notes ?? null };
  if (id) {
    const r = await db.client.updateMany({ where: { id, orgId: ctx.orgId }, data: full });
    if (!r.count) throw new ActionError("Client not found.");
    await audit(ctx, "client.updated", "Client", id, { contractValue: v.contractValue, status: v.status });
    return { ok: true, message: "Client saved" };
  }
  const c = await db.client.create({ data: { ...full, orgId: ctx.orgId } });
  await audit(ctx, "client.created", "Client", c.id, { name: c.name });
  return { ok: true, data: { id: c.id }, message: "Client created" };
});

const deleteClientSchema = z.object({ id: zId });

export const deleteClient = defineAction("MANAGE_WORK", deleteClientSchema, async (ctx, { id }) => {
  const c = await db.client.findFirst({ where: { id, orgId: ctx.orgId }, include: { _count: { select: { invoices: true, projects: true } } } });
  if (!c) throw new ActionError("Client not found.");
  if (c._count.invoices > 0) throw new ActionError("This client has invoices. Mark the client as churned instead of deleting, so financial history stays intact.");
  await db.client.delete({ where: { id } });
  await audit(ctx, "client.deleted", "Client", id, { name: c.name, projects: c._count.projects });
  return { ok: true, message: "Client deleted" };
});
