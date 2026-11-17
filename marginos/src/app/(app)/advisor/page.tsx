import { requireCtx } from "@/lib/tenant";
import { db } from "@/lib/db";
import { advisorModel, aiConfigured } from "@/lib/advisor/llm";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { AdvisorChat } from "./chat";

export const metadata = { title: "AI Advisor" };

export default async function AdvisorPage() {
  const ctx = await requireCtx("USE_ADVISOR");
  const messages = await db.advisorMessage.findMany({ where: { orgId: ctx.orgId, userId: ctx.userId }, orderBy: { createdAt: "asc" }, take: 60 });
  const ai = aiConfigured();
  return (
    <>
      <PageHeader title="AI business advisor" description="Answers come from MarginOS's verified calculations on your own data — never invented figures."
        actions={ai ? <Badge tone="gain" data-testid="advisor-mode">AI connected · {advisorModel()}</Badge> : <Badge tone="warn" data-testid="advisor-mode">Demo mode · no AI provider configured</Badge>} />
      {!ai ? (
        <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn">
          No AI provider key is configured, so the advisor runs in <b>demo mode</b>: deterministic, rule-based answers to common questions, computed from your real data. Set <code>ANTHROPIC_API_KEY</code> on the server to enable open-ended answers by Claude.
        </p>
      ) : null}
      <AdvisorChat initial={messages.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }))} />
    </>
  );
}
