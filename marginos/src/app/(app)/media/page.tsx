import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { options } from "@/lib/options";
import { d, sum, pct as pctCalc } from "@/lib/finance/engine";
import { date, isoDate, money, int, pct } from "@/lib/format";
import { PageHeader, Stat, Note } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmAction, FormDialog, type FieldDef } from "@/components/ui/form-dialog";
import { LinkButton } from "@/components/ui/button";
import { deleteCampaign, saveCampaign } from "./actions";

export const metadata = { title: "Media economics" };

export default async function MediaPage() {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const cur = ctx.org.currency;
  const m = (v: Parameters<typeof money>[0]) => money(v, cur);
  const [rows, integrations, opts] = await Promise.all([
    db.mediaCampaign.findMany({ where: { orgId: ctx.orgId }, include: { client: { select: { name: true } } }, orderBy: { startDate: "desc" } }),
    db.integrationConnection.findMany({ where: { orgId: ctx.orgId } }),
    options(ctx.orgId),
  ]);
  const spend = sum(rows.map((r) => d(r.mediaSpend)));
  const fees = sum(rows.map((r) => d(r.managementFee).plus(d(r.productionFee))));
  const fields: FieldDef[] = [
    { name: "name", label: "Campaign name", required: true, full: true },
    { name: "clientId", label: "Client", type: "select", required: true, options: opts.clients },
    { name: "projectId", label: "Project", type: "select", options: opts.projects },
    { name: "platform", label: "Platform", type: "select", required: true, options: [{ value: "META", label: "Meta (Facebook/Instagram)" }, { value: "GOOGLE", label: "Google Ads" }, { value: "YOUTUBE", label: "YouTube" }, { value: "LINKEDIN", label: "LinkedIn" }, { value: "OTHER", label: "Other" }] },
    { name: "startDate", label: "Start", type: "date", required: true }, { name: "endDate", label: "End", type: "date" },
    { name: "mediaSpend", label: "Media spend (pass-through)", type: "money", hint: "Client's money — never agency revenue" },
    { name: "managementFee", label: "Agency management fee", type: "money" }, { name: "productionFee", label: "Production fee", type: "money" },
    { name: "impressions", label: "Impressions", type: "number" }, { name: "clicks", label: "Clicks", type: "number" }, { name: "conversions", label: "Conversions", type: "number" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  const manage = can(ctx.role, "MANAGE_FINANCE");
  return (
    <>
      <PageHeader title="Media economics" description="Media spend is tracked separately from agency revenue. Agency revenue = management + production fees." actions={manage ? <FormDialog testId="new-campaign" title="Add campaign" triggerLabel="Add campaign" action={saveCampaign} fields={fields} defaults={{ platform: "META", startDate: isoDate(new Date()) }} wide /> : null} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Media spend managed" value={m(spend)} sub="Pass-through · not revenue" />
        <Stat label="Agency fees" value={m(fees)} sub="Management + production" tone="gain" />
        <Stat label="Total billed to clients" value={m(spend.plus(fees))} />
        <Stat label="Effective fee rate" value={pct(pctCalc(fees, spend))} sub="Fees ÷ media spend" />
      </section>
      <Card className="mt-5">
        <DataTable testId="media-table" rows={rows} rowKey={(r) => r.id} empty={<p className="px-5 py-8 text-center text-sm text-muted">No campaigns recorded.</p>} columns={[
          { key: "n", header: "Campaign", primary: true, cell: (r) => r.name },
          { key: "c", header: "Client", cell: (r) => r.client.name },
          { key: "p", header: "Platform", cell: (r) => <Badge>{r.platform}</Badge> },
          { key: "d", header: "Dates", hideOnMobile: true, cell: (r) => `${date(r.startDate)} → ${r.endDate ? date(r.endDate) : "ongoing"}` },
          { key: "s", header: "Media spend", align: "right", cell: (r) => m(r.mediaSpend) },
          { key: "f", header: "Agency revenue", align: "right", highlight: true, cell: (r) => m(d(r.managementFee).plus(d(r.productionFee))) },
          { key: "cv", header: "Conversions", align: "right", cell: (r) => int(r.conversions) },
          { key: "cpa", header: "Cost / conv.", align: "right", cell: (r) => (r.conversions ? m(d(r.mediaSpend).div(r.conversions)) : "—") },
          { key: "src", header: "Source", cell: (r) => <Badge tone="neutral">{r.source === "MANUAL" ? "Manual entry" : r.source}</Badge> },
          { key: "actions", header: "", cell: (r) => manage ? <div className="flex justify-end">
            <FormDialog mode="edit" title="Edit campaign" action={saveCampaign} wide fields={[{ name: "id", label: "id", type: "hidden" }, ...fields]} defaults={{ id: r.id, name: r.name, clientId: r.clientId, projectId: r.projectId, platform: r.platform, startDate: isoDate(r.startDate), endDate: isoDate(r.endDate), mediaSpend: r.mediaSpend.toString(), managementFee: r.managementFee.toString(), productionFee: r.productionFee.toString(), impressions: String(r.impressions), clicks: String(r.clicks), conversions: String(r.conversions), notes: r.notes }} />
            <ConfirmAction action={deleteCampaign} payload={{ id: r.id }} label="Delete" title="Delete campaign?" description="Removes this campaign record." />
          </div> : null },
        ]} />
      </Card>
      <Card className="mt-5">
        <CardHeader title="Ad platform connections" />
        <CardBody className="flex flex-col gap-3 text-[13px]">
          {["META_ADS", "GOOGLE_ADS"].map((p) => {
            const c = integrations.find((i) => i.provider === p);
            return <div key={p} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"><span className="font-medium">{p === "META_ADS" ? "Meta Marketing API" : "Google Ads API"}</span><Badge tone={c?.status === "CONNECTED" ? "gain" : "neutral"}>{c?.status === "CONNECTED" ? "Connected" : "Not connected"}</Badge></div>;
          })}
          <Note>Live sync is not active. Campaign figures above are entered manually. The integration layer is ready (see <code>src/lib/integrations</code>), but connecting requires your own Meta / Google developer credentials and OAuth approval — MarginOS will not show synced data until a real connection succeeds.</Note>
          {can(ctx.role, "MANAGE_ORG") ? <LinkButton href="/settings/integrations" variant="secondary" size="sm" className="self-start">Integration settings</LinkButton> : null}
        </CardBody>
      </Card>
    </>
  );
}
