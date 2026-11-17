import { requireCtx } from "@/lib/tenant";
import { db } from "@/lib/db";
import { advisorModel, aiConfigured } from "@/lib/advisor/llm";
import { CONNECTORS } from "@/lib/integrations";
import { PageHeader, Note } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsTabs } from "../tabs";

export const metadata = { title: "AI & integrations" };

export default async function IntegrationsPage() {
  const ctx = await requireCtx("MANAGE_ORG");
  const conns = await db.integrationConnection.findMany({ where: { orgId: ctx.orgId } });
  const ai = aiConfigured();
  return (
    <>
      <PageHeader title="Settings" description="AI advisor & external integrations" />
      <SettingsTabs active="integrations" />
      <div className="grid max-w-3xl gap-5">
        <Card>
          <CardHeader title="AI business advisor" action={<Badge tone={ai ? "gain" : "warn"} data-testid="ai-status">{ai ? "Connected" : "Not configured — demo mode"}</Badge>} />
          <CardBody className="flex flex-col gap-3 text-[13px]">
            <p>Provider: Anthropic Claude · model <code>{advisorModel()}</code> (override with <code>ADVISOR_MODEL</code>).</p>
            <p className="text-muted">The key is read from the server environment variable <code>ANTHROPIC_API_KEY</code>. It is never stored in the database or sent to the browser. The advisor receives only figures computed by the MarginOS engine for this workspace, has no tools, and cannot change data.</p>
            {!ai ? <Note tone="warn">Without a key, the advisor answers common questions with deterministic rule-based logic over your real data, clearly labelled as demo mode.</Note> : null}
          </CardBody>
        </Card>
        {CONNECTORS.map((c) => {
          const conn = conns.find((x) => x.provider === c.provider);
          return (
            <Card key={c.provider}>
              <CardHeader title={c.label} action={<Badge tone={conn?.status === "CONNECTED" ? "gain" : "neutral"}>{conn?.status === "CONNECTED" ? "Connected" : "Not connected"}</Badge>} />
              <CardBody className="flex flex-col gap-2 text-[13px]">
                <p>App credentials: {c.isConfigured() ? <Badge tone="info">present</Badge> : <Badge>missing</Badge>} <span className="text-muted">({c.requiredEnv.join(", ")})</span></p>
                <p className="text-muted">Live sync is not available in this build. The connector interface is in <code>src/lib/integrations</code>; finishing it requires a registered developer app, OAuth consent and a tested API connection. Until then, campaign data is entered manually on the Media page and labelled “Manual entry”.</p>
                <a className="text-[13px] underline" href={c.docsUrl} target="_blank" rel="noreferrer">Platform documentation</a>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
