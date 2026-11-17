import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { resolvePeriod } from "@/lib/period";
import { loadOrgData } from "@/lib/finance/load";
import { utilisation, d, sum } from "@/lib/finance/engine";
import { date, isoDate, money, pct, hours } from "@/lib/format";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmAction, FormDialog } from "@/components/ui/form-dialog";
import { PeriodFilter } from "@/components/period-filter";
import { employeeFields } from "@/components/forms";
import { deleteEmployee, saveEmployee } from "../actions";

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const { id } = await params;
  const e = await db.employee.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!e) notFound();
  const { key, period, label } = resolvePeriod(await searchParams, "last_month");
  const data = await loadOrgData(ctx.orgId);
  const cur = ctx.org.currency;
  const u = utilisation(data.ds.employees.find((x) => x.id === id)!, data.ds.timeEntries, period);
  const te = data.timeEntries.filter((t) => t.employeeId === id && t.date >= period.from && t.date < period.to);
  const byProject = new Map<string, { h: number; c: number }>();
  for (const t of te) { const x = byProject.get(t.projectId) ?? { h: 0, c: 0 }; x.h += Number(t.hours); x.c += d(t.hours).times(d(t.costRate)).toNumber(); byProject.set(t.projectId, x); }
  const proj = new Map(data.projects.map((p) => [p.id, p.name]));
  const rows = [...byProject.entries()].map(([pid, v]) => ({ pid, name: proj.get(pid) ?? "—", ...v })).sort((a, b) => b.h - a.h);
  const manage = can(ctx.role, "MANAGE_TEAM");
  const salaries = can(ctx.role, "VIEW_SALARIES");
  return (
    <>
      <PageHeader back={{ href: "/team", label: "Team" }} title={<span className="flex items-center gap-2">{e.name}{!e.active ? <StatusBadge status="CANCELLED" /> : null}</span>} description={`${e.designation} · ${e.department}${e.email ? ` · ${e.email}` : ""}`} actions={<>
        <PeriodFilter value={key} />
        {manage ? <FormDialog mode="edit" title="Edit team member" action={saveEmployee} wide fields={[{ name: "id", label: "id", type: "hidden" }, ...employeeFields]}
          defaults={{ id, name: e.name, email: e.email, department: e.department, designation: e.designation, monthlySalary: e.monthlySalary.toString(), benefitsLoadPct: e.benefitsLoadPct.toString(), monthlyHours: e.monthlyHours.toString(), joinedOn: isoDate(e.joinedOn), leftOn: isoDate(e.leftOn), active: e.active }} testId="edit-employee" /> : null}
        {manage ? <ConfirmAction action={deleteEmployee} payload={{ id }} label="Delete" title="Delete team member?" description="Only possible if they have no logged time. Otherwise mark them inactive." /> : null}
      </>} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {salaries ? <Stat label="Monthly salary" value={money(e.monthlySalary, cur)} sub={`+${e.benefitsLoadPct}% employer load`} /> : null}
        <Stat label="Loaded cost / hour" value={money(u.hourlyCost, cur)} />
        <Stat label="Capacity" value={hours(u.capacity)} sub={label} />
        <Stat label="Logged" value={hours(u.logged)} sub={`${pct(u.loadPct, 0)} of capacity`} />
        <Stat label="Utilisation" value={pct(u.utilisationPct)} sub={<StatusBadge status={u.status} />} />
        <Stat label="Cost on projects" value={money(sum(rows.map((r) => d(r.c))), cur)} />
      </section>
      <Card className="mt-5">
        <CardHeader title="Project allocation" description={`Joined ${date(e.joinedOn)}${e.leftOn ? ` · last day ${date(e.leftOn)}` : ""}`} />
        <DataTable rows={rows} rowKey={(r) => r.pid} rowHref={(r) => `/projects/${r.pid}`} empty={<p className="px-5 py-6 text-sm text-muted">No time logged in this period.</p>} columns={[
          { key: "n", header: "Project", primary: true, cell: (r) => r.name },
          { key: "h", header: "Hours", align: "right", highlight: true, cell: (r) => hours(r.h) },
          { key: "s", header: "Share", align: "right", cell: (r) => pct(u.logged.gt(0) ? (r.h / u.logged.toNumber()) * 100 : null, 0) },
          { key: "c", header: "Cost", align: "right", cell: (r) => money(r.c, cur) },
        ]} />
      </Card>
    </>
  );
}
