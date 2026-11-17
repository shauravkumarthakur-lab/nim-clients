import Link from "next/link";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { resolvePeriod, periodQuery } from "@/lib/period";
import { loadOrgData } from "@/lib/finance/load";
import { alerts as getAlerts, scopeSummary } from "@/lib/finance/analytics";
import { options } from "@/lib/options";
import { SCOPE_TYPES } from "@/lib/constants";
import { date, isoDate, money, hours } from "@/lib/format";
import { PageHeader, Stat, Tabs } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { PeriodFilter } from "@/components/period-filter";
import { LinkButton } from "@/components/ui/button";
import { scopeFields } from "@/components/forms";
import { saveScopeChange } from "./actions";
import { ScopeActions } from "./scope-actions";

export const metadata = { title: "Scope creep" };

export default async function ScopePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const sp = await searchParams;
  const { key, period, label } = resolvePeriod(sp, "last_3_months");
  const data = await loadOrgData(ctx.orgId);
  const opts = await options(ctx.orgId);
  const cur = ctx.org.currency;
  const m = (v: Parameters<typeof money>[0]) => money(v, cur);
  const s = scopeSummary(data, period);
  const alerts = getAlerts(data, ctx.org.targetMarginPct);
  const status = sp.status ?? "open";
  const projName = new Map(data.projects.map((p) => [p.id, p.name]));
  const changes = data.scope
    .filter((x) => status === "all" || (status === "open" ? ["LOGGED", "QUOTED"].includes(x.status) : x.status === status))
    .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  const byProject = data.projects.map((p) => ({ p, s: scopeSummary(data, period, [p.id]) })).filter((x) => x.s.outOfScopeCost.gt(0) || x.s.pendingCount > 0).sort((a, b) => b.s.unrecovered.comparedTo(a.s.unrecovered));
  const q = periodQuery(key, period);
  return (
    <>
      <PageHeader title="Scope creep intelligence" description={`What extra work is costing you · ${label}`} actions={<>
        <PeriodFilter value={key} />
        <LinkButton href={`/reports/scope?${q}`} variant="secondary" size="sm">Report</LinkButton>
        {can(ctx.role, "MANAGE_WORK") ? <FormDialog title="Log scope change" triggerLabel="Log request" action={saveScopeChange} testId="new-scope-global" fields={scopeFields(opts.projects, opts.deliverables)} defaults={{ type: "ADDITIONAL_DELIVERABLE", requestedAt: isoDate(new Date()) }} wide /> : null}
      </>} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="scope-kpis">
        <Stat label="Out-of-scope work" value={hours(s.outOfScopeHours)} sub={`${m(s.outOfScopeLabourCost)} team time`} />
        <Stat label="Scope creep cost" value={m(s.outOfScopeCost)} sub={`incl. ${m(s.outOfScopeExpense)} expenses`} />
        <Stat label="Recovered" value={m(s.recovered)} sub="Approved change requests" tone="gain" />
        <Stat label="Unbilled / absorbed" value={m(s.unrecovered)} tone={s.unrecovered.gt(0) ? "loss" : undefined} sub="Cost not recovered" />
        <Stat label="Pending requests" value={s.pendingCount} sub={`${m(s.pendingEstimatedCost)} estimated · ${s.extraRevisions} extra revisions`} tone={s.pendingCount ? "warn" : undefined} />
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card id="alerts">
          <CardHeader title="Alerts" description="Revision limits, unquoted extra work, hours & budget overruns, margin below target" />
          <CardBody className="pt-2">
            {alerts.length ? <ul className="divide-y divide-border" data-testid="all-alerts">{alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 py-2 text-[13px]">
                {a.severity === "high" ? <CircleAlert size={15} className="mt-0.5 shrink-0 text-loss" /> : <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" />}
                <Link className="hover:underline" href={`/projects/${a.projectId}${a.scopeChangeId ? "#scope" : a.deliverableId ? "#deliverables" : ""}`}>{a.message}</Link>
              </li>))}</ul> : <p className="text-sm text-muted">No alerts.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Impact by project" description={label} />
          <DataTable rows={byProject} rowKey={(r) => r.p.id} rowHref={(r) => `/projects/${r.p.id}#scope`} empty={<p className="px-5 py-6 text-sm text-muted">No out-of-scope work recorded.</p>} columns={[
            { key: "n", header: "Project", primary: true, cell: (r) => r.p.name },
            { key: "h", header: "Hours", align: "right", cell: (r) => hours(r.s.outOfScopeHours) },
            { key: "c", header: "Cost", align: "right", cell: (r) => m(r.s.outOfScopeCost) },
            { key: "r", header: "Recovered", align: "right", cell: (r) => m(r.s.recovered) },
            { key: "u", header: "Unrecovered", align: "right", highlight: true, cell: (r) => <span className={r.s.unrecovered.gt(0) ? "text-loss" : ""}>{m(r.s.unrecovered)}</span> },
          ]} />
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Change log" />
        <div className="px-4 sm:px-5"><Tabs active={status} items={[
          { key: "open", href: "/scope?status=open", label: "Open" }, { key: "APPROVED", href: "/scope?status=APPROVED", label: "Approved" },
          { key: "INVOICED", href: "/scope?status=INVOICED", label: "Invoiced" }, { key: "ABSORBED", href: "/scope?status=ABSORBED", label: "Absorbed" }, { key: "all", href: "/scope?status=all", label: "All" },
        ]} /></div>
        <DataTable testId="scope-table" rows={changes} rowKey={(c) => c.id} empty={<p className="px-5 py-6 text-sm text-muted">Nothing here.</p>} columns={[
          { key: "t", header: "Request", primary: true, cell: (c) => <span>{c.changeRequestNo ? <span className="text-subtle">{c.changeRequestNo} · </span> : null}{c.title}</span> },
          { key: "p", header: "Project", cell: (c) => <Link href={`/projects/${c.projectId}#scope`} className="hover:underline">{projName.get(c.projectId)}</Link> },
          { key: "ty", header: "Type", cell: (c) => SCOPE_TYPES.find((t) => t.value === c.type)?.label },
          { key: "d", header: "Requested", cell: (c) => date(c.requestedAt) },
          { key: "e", header: "Est. cost", align: "right", cell: (c) => m(c.estimatedCost) },
          { key: "q", header: "Quoted", align: "right", cell: (c) => (c.quotedAmount ? m(c.quotedAmount) : "—") },
          { key: "s", header: "Status", highlight: true, cell: (c) => <StatusBadge status={c.status} /> },
          { key: "actions", header: "", cell: (c) => can(ctx.role, "MANAGE_WORK") ? <ScopeActions s={{ id: c.id, status: c.status, quotedAmount: c.quotedAmount?.toString() ?? null, estimatedCost: c.estimatedCost.toString(), sharedWithClient: c.sharedWithClient }} /> : null },
        ]} />
      </Card>
    </>
  );
}
