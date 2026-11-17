import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CircleAlert, TriangleAlert } from "lucide-react";
import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { resolvePeriod, periodQuery } from "@/lib/period";
import { dashboard, monthlyTrend } from "@/lib/finance/analytics";
import { money, pct, hours } from "@/lib/format";
import { PageHeader, Stat, EmptyState, Bar } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { PeriodFilter } from "@/components/period-filter";
import { HBarChart, MarginTrendChart, RevenueExpenseChart } from "@/components/charts/charts";
import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx();
  if (!can(ctx.role, "VIEW_FINANCIALS")) redirect("/time");
  const sp = await searchParams;
  const { key, period, label } = resolvePeriod(sp);
  const q = periodQuery(key, period);
  const cur = ctx.org.currency;
  const m = (v: Parameters<typeof money>[0]) => money(v, cur);
  const db = await dashboard(ctx.orgId, period, ctx.org.overheadMethod, ctx.org.targetMarginPct);
  const { pnl } = db;
  const trend = monthlyTrend(db.data, 6);

  if (!db.hasData)
    return (
      <>
        <PageHeader title="Financial command centre" description={ctx.org.name} />
        <EmptyState title="Your command centre fills up as you work"
          description="MarginOS never shows sample numbers in a real workspace. Add records and every figure here is calculated from them."
          action={
            <div className="flex flex-col gap-2 text-left text-sm">
              {[["/clients", "1. Add a client"], ["/projects", "2. Create a project with deliverables"], ["/team", "3. Add your team (salaries → cost per hour)"], ["/time", "4. Log time against projects"], ["/expenses", "5. Record expenses"], ["/invoices", "6. Raise an invoice"]].map(([h, l]) => (
                <Link key={h} href={h} className="flex items-center justify-between gap-6 rounded-lg border border-border px-3 py-2 hover:bg-surface-2">{l} <ArrowRight size={14} /></Link>
              ))}
            </div>
          } />
      </>
    );

  return (
    <>
      <PageHeader title="Financial command centre" description={`${ctx.org.name} · ${label}`} actions={<PeriodFilter value={key} />} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6" aria-label="Key figures" data-testid="kpis">
        <Stat label="Revenue" value={m(pnl.revenue)} sub={`${m(pnl.cashCollected)} collected`} href={`/invoices?${q}`} />
        <Stat label="Total costs" value={m(pnl.totalCosts)} sub={`${m(pnl.totalExpenses)} expenses + payroll`} href={`/expenses?${q}`} />
        <Stat label="Gross profit" value={m(pnl.grossProfit)} sub={`${pct(pnl.grossMarginPct)} after external costs`} tone={pnl.grossProfit.lt(0) ? "loss" : undefined} href={`/reports/monthly?${q}`} />
        <Stat label="Contribution" value={m(pnl.contributionProfit)} sub={`${pct(pnl.contributionMarginPct)} margin`} tone={pnl.contributionProfit.lt(0) ? "loss" : "gain"} href={`/clients?${q}`} />
        <Stat label="Net profit" value={m(pnl.netProfit)} sub={`${pct(pnl.netMarginPct)} net margin`} tone={pnl.netProfit.lt(0) ? "loss" : undefined} href={`/reports/monthly?${q}`} />
        <Stat label="Outstanding" value={m(db.receivables.total)} sub={<span className={db.receivables.overdueCount ? "text-loss" : ""}>{db.receivables.count} invoices · {db.receivables.overdueCount} overdue</span>} href="/invoices?status=outstanding" />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active projects" value={db.activeProjects} href="/projects?status=ACTIVE" />
        <Stat label="Team utilisation" value={pct(db.utilisation.teamPct)} sub={`${db.utilisation.under} under · ${db.utilisation.over} overloaded`} href={`/team?${q}`} tone={db.utilisation.teamPct && db.utilisation.teamPct.lt(60) ? "warn" : undefined} />
        <Stat label="Scope creep cost" value={m(db.scope.outOfScopeCost)} sub={`${hours(db.scope.outOfScopeHours)} · ${m(db.scope.unrecovered)} unrecovered`} tone={db.scope.unrecovered.gt(0) ? "loss" : undefined} href={`/scope?${q}`} />
        <Stat label="Open alerts" value={db.alerts.length} sub={`${db.alerts.filter((a) => a.severity === "high").length} high priority`} tone={db.alerts.length ? "warn" : undefined} href="/scope#alerts" />
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue vs costs" description="Last 6 months · costs include payroll and all expenses" />
          <CardBody><RevenueExpenseChart data={trend} currency={cur} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Profit bridge" description={`How ${label.toLowerCase()} net profit is calculated`} />
          <CardBody className="text-[13px]">
            <dl className="flex flex-col gap-2" data-testid="profit-bridge">
              {[
                ["Revenue (invoiced, ex-tax)", pnl.revenue, "strong"],
                ["− Direct external costs", pnl.directExternal.neg(), ""],
                ["= Gross profit", pnl.grossProfit, "strong"],
                ["− Direct labour (logged time)", pnl.directLabour.neg(), ""],
                ["= Contribution profit", pnl.contributionProfit, "strong"],
                ["− Unallocated payroll", pnl.unallocatedLabour.neg(), ""],
                ["− Indirect expenses (overhead)", pnl.indirectExpenses.neg(), ""],
                ["= Net profit", pnl.netProfit, "strong"],
              ].map(([l, v, s]) => (
                <div key={String(l)} className={`flex justify-between gap-3 ${s ? "border-t border-border pt-2 font-semibold" : "text-muted"}`}>
                  <dt>{String(l)}</dt><dd className={`num ${(v as typeof pnl.revenue).lt(0) && s ? "text-loss" : ""}`}>{m(v as typeof pnl.revenue)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] text-subtle">Each cost is counted once. <Link className="underline" href="/reports/methodology">Methodology</Link></p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue by client" description={label} action={<LinkButton href={`/clients?${q}`} variant="ghost" size="sm">All clients</LinkButton>} />
          <CardBody>
            {db.revenueByClient.length ? <HBarChart testId="chart-client-revenue" currency={cur} data={db.revenueByClient.slice(0, 8).map((r) => ({ name: r.client.name, value: r.revenue.toNumber() }))} /> : <p className="text-sm text-muted">No invoiced revenue in this period.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Contribution margin trend" description="Last 6 months" />
          <CardBody><MarginTrendChart data={trend} /></CardBody>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ClientRank title="Most profitable clients" rows={db.mostProfitable} cur={cur} q={q} />
        <ClientRank title="Least profitable clients" rows={db.leastProfitable} cur={cur} q={q} testId="least-profitable" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card id="alerts">
          <CardHeader title="Scope & budget alerts" description="Calculated live from projects, deliverables and change requests" action={<LinkButton href="/scope" variant="ghost" size="sm">Scope creep</LinkButton>} />
          <CardBody className="pt-3">
            {db.alerts.length ? (
              <ul className="flex flex-col divide-y divide-border" data-testid="alerts">
                {db.alerts.slice(0, 8).map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5 py-2.5 text-[13px]">
                    {a.severity === "high" ? <CircleAlert size={16} className="mt-0.5 shrink-0 text-loss" /> : <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />}
                    <Link href={`/projects/${a.projectId}`} className="hover:underline">{a.message}</Link>
                  </li>
                ))}
                {db.alerts.length > 8 ? <li className="pt-2 text-[12px] text-muted">+{db.alerts.length - 8} more on the scope page</li> : null}
              </ul>
            ) : <p className="text-sm text-muted">No alerts. Projects are within scope, budget and margin targets.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Employee utilisation" description={`Billable hours ÷ capacity · ${label}`} action={<LinkButton href={`/team?${q}`} variant="ghost" size="sm">Team</LinkButton>} />
          <CardBody className="pt-3">
            <ul className="flex flex-col gap-3">
              {db.utilisation.rows.sort((a, b) => (b.u.utilisationPct?.toNumber() ?? 0) - (a.u.utilisationPct?.toNumber() ?? 0)).slice(0, 8).map(({ employee, u }) => (
                <li key={employee.id} className="text-[13px]">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate">{employee.name} <span className="text-subtle">· {employee.designation}</span></span>
                    <span className="flex shrink-0 items-center gap-2"><span className="num">{pct(u.utilisationPct, 0)}</span><StatusBadge status={u.status} /></span>
                  </div>
                  <Bar value={u.utilisationPct?.toNumber() ?? 0} tone={u.status === "OVERLOADED" ? "loss" : u.status === "UNDERUTILISED" ? "warn" : "brand"} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function ClientRank({ title, rows, cur, q, testId }: { title: string; rows: Awaited<ReturnType<typeof dashboard>>["mostProfitable"]; cur: string; q: string; testId?: string }) {
  return (
    <Card>
      <CardHeader title={title} description="By contribution margin" />
      <CardBody className="pt-2">
        {rows.length ? (
          <ul className="divide-y divide-border" data-testid={testId}>
            {rows.map((r) => (
              <li key={r.clientId} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <Link href={`/clients/${r.clientId}?${q}`} className="min-w-0 truncate font-medium hover:underline">{r.client.name}</Link>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="num hidden text-muted sm:inline">{money(r.revenue, cur, { compact: true })}</span>
                  <span className={`num w-24 text-right ${r.contributionProfit.lt(0) ? "text-loss" : ""}`}>{money(r.contributionProfit, cur, { compact: true })}</span>
                  <Badge tone={r.contributionMarginPct === null ? "neutral" : r.contributionMarginPct.lt(0) ? "loss" : r.contributionMarginPct.lt(30) ? "warn" : "gain"} className="num w-16 justify-center">{pct(r.contributionMarginPct)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No client revenue in this period.</p>}
      </CardBody>
    </Card>
  );
}
