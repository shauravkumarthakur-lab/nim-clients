"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defineAction, zDate, zId, zInt, zMoneyPos, zText } from "@/lib/action";
import { assertOwned } from "@/lib/owned";
import { ActionError } from "@/lib/tenant";
import { audit } from "@/lib/audit";

const saveCampaignSchema = z.object({
  id: zId.optional(), clientId: zId, projectId: zId.optional(), platform: z.enum(["META", "GOOGLE", "YOUTUBE", "LINKEDIN", "OTHER"]), name: z.string().trim().min(2).max(160),
  startDate: zDate, endDate: zDate.optional(), mediaSpend: zMoneyPos.default("0"), managementFee: zMoneyPos.default("0"), productionFee: zMoneyPos.default("0"),
  impressions: zInt(0).default(0), clicks: zInt(0).default(0), conversions: zInt(0).default(0), notes: zText(1000).optional(),
});

export const saveCampaign = defineAction("MANAGE_FINANCE", saveCampaignSchema, async (ctx, v) => {
  await assertOwned(ctx.orgId, { client: v.clientId, project: v.projectId });
  const { id, ...rest } = v;
  const data = { ...rest, projectId: rest.projectId ?? null, endDate: rest.endDate ?? null, notes: rest.notes ?? null };
  if (id) {
    const r = await db.mediaCampaign.updateMany({ where: { id, orgId: ctx.orgId }, data });
    if (!r.count) throw new ActionError("Campaign not found.");
  } else await db.mediaCampaign.create({ data: { ...data, orgId: ctx.orgId, source: "MANUAL" } });
  await audit(ctx, id ? "campaign.updated" : "campaign.created", "MediaCampaign", id, { mediaSpend: v.mediaSpend });
  return { ok: true, message: "Campaign saved" };
});

const deleteCampaignSchema = z.object({ id: zId });

export const deleteCampaign = defineAction("MANAGE_FINANCE", deleteCampaignSchema, async (ctx, { id }) => {
  const r = await db.mediaCampaign.deleteMany({ where: { id, orgId: ctx.orgId } });
  if (!r.count) throw new ActionError("Campaign not found.");
  return { ok: true, message: "Campaign deleted" };
});
