import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { resolvePeriod } from "@/lib/period";
import { loadOrgData } from "@/lib/finance/load";
import { utilisationRows } from "@/lib/finance/analytics";
import { loadedHourlyCost, sum, d } from "@/lib/finance/engine";
import { money, pct, hours } from "@/lib/format";
import { PageHeader, Stat, Bar } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { PeriodFilter } from "@/components/period-filter";
import { HBarChart } from "@/components/charts/charts";
import { employeeFields } from "@/components/forms";
import { saveEmployee } from "./actions";

export const metadata = { title: "Team" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const sp = await searchParams;
  const { key, period, label } = resolvePeriod(sp, "last_month");
  const data = await loadOrgData(ctx.orgId);
  const cur = ctx.org.currency;
  const salaries = can(ctx.role, "VIEW_SALARIES");
  const rows = utilisationRows(data, period).sort((a, b) => (b.u.utilisationPct?.toNumber() ?? 0) - (a.u.utilisationPct?.toNumber() ?? 0));
  const cap = sum(rows.map((r) => r.u.capacity));
  const bill = sum(rows.map((r) => r.u.billable));
  const logged = sum(rows.map((r) => r.u.logged));
  // In-house vs freelancer: average loaded hourly cost vs freelancer hourly rates
  const avgInHouse = rows.length ? sum(rows.map((r) => r.u.hourlyCost)).div(rows.length) : d(0);
  const flSpend = data.ds.expenses.filter((e) => e.kind === "FREELANCER" && e.date >= period.from && e.date < period.to);
  const byDept = new Map<string, { cost: number; n: number }>();
  for (const r of rows) { const x = byDept.get(r.employee.department) ?? { cost: 0, n: 0 }; x.cost += r.u.hourlyCost.toNumber(); x.n++; byDept.set(r.employee.department, x); }
  return (
    <>
      <PageHeader title="Team & resource cost" description={`Utilisation = billable hours ÷ capacity · ${label}`} actions={<>
        <PeriodFilter value={key} />
        {can(ctx.role, "MANAGE_TEAM") ? <FormDialog testId="new-employee" title="Add team member" triggerLabel="Add team member" action={saveEmployee} fields={employeeFields} defaults={{ monthlyHours: "176", benefitsLoadPct: "12", active: true, department: "Creative" }} wide /> : null}
      </>} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Team utilisation" value={pct(cap.gt(0) ? bill.div(cap).times(100) : null)} sub={`Target ${ctx.org.utilisationTarget}%`} />
        <Stat label="Capacity" value={hours(cap)} />
        <Stat label="Logged" value={hours(logged)} sub={`${hours(bill)} billable`} />
        <Stat label="Underutilised" value={rows.filter((r) => r.u.status === "UNDERUTILISED").length} tone="warn" sub="< 60% billable" />
        <Stat label="Overloaded" value={rows.filter((r) => r.u.status === "OVERLOADED").length} tone="loss" sub="> 100% of capacity" />
      </section>
      <Card className="mt-5">
        <DataTable testId="team-table" rows={rows} rowKey={(r) => r.employee.id} rowHref={(r) => `/team/${r.employee.id}?period=${key}`} columns={[
          { key: "n", header: "Name", primary: true, cell: (r) => r.employee.name },
          { key: "dg", header: "Role", cell: (r) => `${r.employee.designation} · ${r.employee.department}` },
          ...(salaries ? [{ key: "s", header: "Salary / mo", align: "right" as const, cell: (r: (typeof rows)[number]) => money(r.employee.monthlySalary, cur) }] : []),
          { key: "hc", header: "Loaded cost / h", align: "right", cell: (r) => money(r.u.hourlyCost, cur) },
          { key: "cap", header: "Capacity", align: "right", hideOnMobile: true, cell: (r) => hours(r.u.capacity) },
          { key: "lg", header: "Logged", align: "right", cell: (r) => hours(r.u.logged) },
          { key: "b", header: "Billable", align: "right", cell: (r) => hours(r.u.billable) },
          { key: "u", header: "Utilisation", cell: (r) => <div className="w-28"><div className="mb-1 text-[12px] num">{pct(r.u.utilisationPct, 0)}</div><Bar value={r.u.utilisationPct?.toNumber() ?? 0} tone={r.u.status === "OVERLOADED" ? "loss" : r.u.status === "UNDERUTILISED" ? "warn" : "brand"} /></div> },
          { key: "st", header: "Status", highlight: true, cell: (r) => <StatusBadge status={r.u.status} /> },
        ]} />
      </Card>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Loaded cost per hour by department" description="Salary × (1 + employer load) ÷ monthly hours, averaged" />
          <CardBody><HBarChart currency={cur} data={[...byDept.entries()].map(([k, v]) => ({ name: k, value: Math.round(v.cost / v.n) }))} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="In-house vs freelancer" description={label} />
          <CardBody className="text-[13px]">
            <dl className="grid grid-cols-[1fr_auto] gap-y-2">
              <dt className="text-muted">Average in-house loaded cost / hour</dt><dd className="num font-medium">{money(avgInHouse, cur)}</dd>
              {data.freelancers.filter((f) => f.rateType === "HOURLY").map((f) => <div key={f.id} className="contents"><dt className="text-muted">{f.name} ({f.skill}) hourly rate</dt><dd className={`num font-medium ${f.rate.gt(avgInHouse.toString()) ? "text-loss" : "text-gain"}`}>{money(f.rate, cur)}</dd></div>)}
              <dt className="border-t border-border pt-2 text-muted">Freelancer spend in period</dt><dd className="num border-t border-border pt-2 font-medium">{money(sum(flSpend.map((e) => d(e.amount))), cur)}</dd>
              <dt className="text-muted">In-house direct labour in period</dt><dd className="num font-medium">{money(sum(data.ds.timeEntries.filter((t) => t.date >= period.from && t.date < period.to).map((t) => d(t.hours).times(d(t.costRate)).toDecimalPlaces(2))), cur)}</dd>
            </dl>
            <p className="mt-3 text-[12px] text-subtle">Freelancer rates above your in-house average are highlighted red. With underutilised staff ({rows.filter((r) => r.u.status === "UNDERUTILISED").map((r) => r.employee.name.split(" ")[0]).join(", ") || "none"}), consider moving freelance work in-house.</p>
          </CardBody>
        </Card>
      </div>
      <p className="mt-3 text-[12px] text-subtle">Employee load % covers PF, insurance, benefits and equipment. Loaded cost per hour is snapshotted on each time entry, so salary changes don&apos;t rewrite past project costs. Loaded rate formula: {money(loadedHourlyCost({ id: "x", monthlySalary: 100000, benefitsLoadPct: 12, monthlyHours: 176 }), cur)}/h for ₹1,00,000 salary, 12% load, 176 h.</p>
    </>
  );
}
