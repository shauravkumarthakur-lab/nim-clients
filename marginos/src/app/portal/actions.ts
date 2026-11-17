"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCtx } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/action";

/** Portal context: CLIENT role only; every query is pinned to (orgId, clientId). */
async function portalCtx() {
  const ctx = await getCtx();
  if (!ctx || ctx.role !== "CLIENT" || !ctx.clientId) return null;
  return ctx as typeof ctx & { clientId: string };
}

const reviewSchema = z.object({ id: z.string().min(1), decision: z.enum(["APPROVE", "CHANGES"]), feedback: z.string().trim().max(2000).optional() });

export async function reviewDeliverable(_: unknown, input: FormData | Record<string, unknown>): Promise<ActionResult> {
  const ctx = await portalCtx();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const raw = input instanceof FormData ? Object.fromEntries(input) : input;
  const v = reviewSchema.safeParse(raw);
  if (!v.success) return { ok: false, error: "Invalid request." };
  if (v.data.decision === "CHANGES" && !v.data.feedback) return { ok: false, error: "Tell the team what to change.", fieldErrors: { feedback: "Required when requesting changes" } };
  const dl = await db.deliverable.findFirst({ where: { id: v.data.id, orgId: ctx.orgId, sharedWithClient: true, project: { clientId: ctx.clientId, sharedWithClient: true } } });
  if (!dl) return { ok: false, error: "Deliverable not found." };
  await db.deliverable.update({ where: { id: dl.id }, data: v.data.decision === "APPROVE"
    ? { status: "APPROVED", clientFeedback: v.data.feedback ?? null }
    : { status: "CHANGES_REQUESTED", clientFeedback: v.data.feedback ?? null, revisionCount: { increment: 1 } } });
  await audit(ctx, `portal.deliverable_${v.data.decision.toLowerCase()}`, "Deliverable", dl.id, { feedback: v.data.feedback });
  revalidatePath("/portal");
  return { ok: true, message: v.data.decision === "APPROVE" ? "Approved — thank you" : "Change request sent to the team" };
}

const respondSchema = z.object({ id: z.string().min(1), decision: z.enum(["APPROVE", "REJECT"]), note: z.string().trim().max(1000).optional() });

export async function respondChangeRequest(_: unknown, input: FormData | Record<string, unknown>): Promise<ActionResult> {
  const ctx = await portalCtx();
  if (!ctx) return { ok: false, error: "Not authorised." };
  const raw = input instanceof FormData ? Object.fromEntries(input) : input;
  const v = respondSchema.safeParse(raw);
  if (!v.success) return { ok: false, error: "Invalid request." };
  const s = await db.scopeChange.findFirst({ where: { id: v.data.id, orgId: ctx.orgId, sharedWithClient: true, status: "QUOTED", project: { clientId: ctx.clientId } } });
  if (!s) return { ok: false, error: "This change request is no longer awaiting a decision." };
  await db.scopeChange.update({ where: { id: s.id }, data: { status: v.data.decision === "APPROVE" ? "APPROVED" : "REJECTED", clientResponse: v.data.note ?? (v.data.decision === "APPROVE" ? "Approved in client portal" : "Declined in client portal") } });
  await audit(ctx, `portal.change_${v.data.decision.toLowerCase()}`, "ScopeChange", s.id, { quoted: s.quotedAmount?.toString() });
  revalidatePath("/portal");
  return { ok: true, message: v.data.decision === "APPROVE" ? "Change request approved" : "Change request declined" };
}
