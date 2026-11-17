import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { resolvePeriod, periodQuery } from "@/lib/period";
import { loadOrgData } from "@/lib/finance/load";
import { clientRows } from "@/lib/finance/analytics";
import { sum } from "@/lib/finance/engine";
import { options } from "@/lib/options";
import { money, pct, hours } from "@/lib/format";
import { PageHeader, Signed, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { LinkButton } from "@/components/ui/button";
import { PeriodFilter } from "@/components/period-filter";
import { SearchBox } from "@/components/search-box";
import { clientFields } from "@/components/forms";
import { saveClient } from "./actions";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const sp = await searchParams;
  const { key, period, label } = resolvePeriod(sp, "last_3_months");
  const q = periodQuery(key, period);
  const data = await loadOrgData(ctx.orgId);
  const opts = await options(ctx.orgId);
  const cur = ctx.org.currency;
  const search = (sp.q ?? "").toLowerCase();
  let rows = clientRows(data, period, ctx.org.overheadMethod).filter((r) => !search || r.client.name.toLowerCase().includes(search) || (r.client.industry ?? "").toLowerCase().includes(search));
  if (sp.filter === "destroyers") rows = rows.filter((r) => r.revenue.gt(0) && (r.contributionMarginPct?.lt(20) ?? false));
  rows.sort((a, b) => b.revenue.comparedTo(a.revenue));
  const destroyers = clientRows(data, period, ctx.org.overheadMethod).filter((r) => r.revenue.gt(0) && (r.contributionMarginPct?.lt(20) ?? false)).length;

  return (
    <>
      <PageHeader title="Clients" description={`Profitability by client · ${label} · overhead allocated by ${ctx.org.overheadMethod === "REVENUE_SHARE" ? "revenue share" : "labour hours"}`}
        actions={<>
          <PeriodFilter value={key} />
          <LinkButton href={`/api/export/clients?${q}`} variant="secondary" size="sm" prefetch={false}>Export CSV</LinkButton>
          {can(ctx.role, "MANAGE_WORK") ? <FormDialog testId="new-client" title="New client" triggerLabel="New client" action={saveClient} fields={clientFields(opts.employees)} defaults={{ status: "ACTIVE", billingFrequency: "MONTHLY", contractValue: "0" }} wide /> : null}
        </>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Search clients" />
        <Link href={sp.filter === "destroyers" ? `/clients?${q}` : `/clients?${q}&filter=destroyers`} className={`rounded-lg border px-3 py-2 text-[13px] ${sp.filter === "destroyers" ? "border-loss bg-loss-soft text-loss" : "border-border text-muted hover:text-fg"}`} data-testid="filter-destroyers">
          Margin destroyers ({destroyers})
        </Link>
      </div>
      <Card>
        <DataTable testId="clients-table" rows={rows} rowKey={(r) => r.clientId} rowHref={(r) => `/clients/${r.clientId}?${q}`}
          empty={<div className="p-4"><EmptyState title="No clients yet" description="Add your first client to start tracking profitability." /></div>}
          columns={[
            { key: "name", header: "Client", primary: true, cell: (r) => r.client.name },
            { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.client.status} /> },
            { key: "rev", header: "Revenue", align: "right", cell: (r) => money(r.revenue, cur) },
            { key: "cost", header: "Direct costs", align: "right", cell: (r) => money(r.directCosts, cur) },
            { key: "hours", header: "Hours", align: "right", hideOnMobile: true, cell: (r) => hours(r.hours) },
            { key: "contrib", header: "Contribution", align: "right", cell: (r) => <Signed value={r.contributionProfit.toNumber()}>{money(r.contributionProfit, cur)}</Signed> },
            { key: "margin", header: "Margin", align: "right", highlight: true, cell: (r) => <Badge tone={r.contributionMarginPct === null ? "neutral" : r.contributionMarginPct.lt(0) ? "loss" : r.contributionMarginPct.lt(30) ? "warn" : "gain"}>{pct(r.contributionMarginPct)}</Badge> },
            { key: "oh", header: "Overhead", align: "right", hideOnMobile: true, cell: (r) => money(r.allocatedOverhead, cur) },
            { key: "net", header: "Net profit", align: "right", cell: (r) => <Signed value={r.netProfit.toNumber()}>{money(r.netProfit, cur)}</Signed> },
          ]}
          footer={rows.length ? (
            <tr className="border-t border-border-strong font-semibold"><td className="px-4 py-2.5" colSpan={2}>Total</td>
              <td className="num px-4 text-right">{money(sum(rows.map((r) => r.revenue)), cur)}</td>
              <td className="num px-4 text-right">{money(sum(rows.map((r) => r.directCosts)), cur)}</td>
              <td className="num px-4 text-right">{hours(sum(rows.map((r) => r.hours)))}</td>
              <td className="num px-4 text-right">{money(sum(rows.map((r) => r.contributionProfit)), cur)}</td><td />
              <td className="num px-4 text-right">{money(sum(rows.map((r) => r.allocatedOverhead)), cur)}</td>
              <td className="num px-4 text-right">{money(sum(rows.map((r) => r.netProfit)), cur)}</td></tr>
          ) : null} />
      </Card>
      <p className="mt-3 text-[12px] text-subtle">Contribution = revenue − direct costs (team time at loaded cost + freelancers + production + other direct expenses). Margin = contribution ÷ revenue.</p>
    </>
  );
}
