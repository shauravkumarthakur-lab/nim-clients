"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defineAction } from "@/lib/action";
import { ActionError } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { loadOrgData } from "@/lib/finance/load";
import { addMonths, computePnL, monthStart } from "@/lib/finance/engine";
import { buildFacts } from "@/lib/advisor/facts";
import { demoAnswer } from "@/lib/advisor/demo";
import { aiConfigured, llmAnswer } from "@/lib/advisor/llm";

const askAdvisorSchema = z.object({ question: z.string().trim().min(3, "Ask a question").max(1000) });

export const askAdvisor = defineAction("USE_ADVISOR", askAdvisorSchema, async (ctx, { question }) => {
  if (!rateLimit(`advisor:${ctx.userId}`, 20, 10 * 60_000).ok) throw new ActionError("You're asking quickly — wait a few minutes and try again.");
  const data = await loadOrgData(ctx.orgId);
  const facts = buildFacts(data, { name: ctx.org.name, currency: ctx.org.currency, targetMarginPct: ctx.org.targetMarginPct, overheadMethod: ctx.org.overheadMethod });
  const mode = aiConfigured() ? "ai" : "demo";
  let text: string;
  let sources: { label: string; href: string }[] = [];
  if (mode === "ai") {
    const history = (await db.advisorMessage.findMany({ where: { orgId: ctx.orgId, userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 8 })).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const r = await llmAnswer(question, facts, history);
    if (!r.ok) throw new ActionError(r.error);
    text = r.text;
  } else {
    const now = new Date();
    const pnl3 = computePnL(data.ds, { from: addMonths(monthStart(now), -3), to: monthStart(now) });
    const a = demoAnswer(question, facts, pnl3);
    text = a.text;
    sources = a.sources;
  }
  const stored = text + (sources.length ? "\n\nSources: " + sources.map((s) => `[${s.label}](${s.href})`).join(" · ") : "");
  await db.advisorMessage.createMany({ data: [
    { orgId: ctx.orgId, userId: ctx.userId, role: "user", content: question, mode },
    { orgId: ctx.orgId, userId: ctx.userId, role: "assistant", content: stored, mode },
  ] });
  return { ok: true, data: { mode } };
});

export const clearAdvisor = defineAction("USE_ADVISOR", z.object({}), async (ctx) => {
  await db.advisorMessage.deleteMany({ where: { orgId: ctx.orgId, userId: ctx.userId } });
  return { ok: true, message: "Conversation cleared" };
});
