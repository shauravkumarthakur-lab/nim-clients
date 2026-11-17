import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { resolvePeriod, periodQuery } from "@/lib/period";
import { options } from "@/lib/options";
import { d, sum } from "@/lib/finance/engine";
import { date, isoDate, money, hours, titleCase } from "@/lib/format";
import { PageHeader, Stat, Note } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmAction, FormDialog } from "@/components/ui/form-dialog";
import { LinkButton } from "@/components/ui/button";
import { PeriodFilter } from "@/components/period-filter";
import { FilterSelect } from "@/components/filter-select";
import { CsvImport } from "@/components/csv-import";
import { timeFields } from "@/components/forms";
import { deleteTimeEntry, saveTimeEntry } from "./actions";

export const metadata = { title: "Time" };

export default async function TimePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx("LOG_TIME");
  const sp = await searchParams;
  const { key, period, label } = resolvePeriod(sp, "this_month");
  const seeAll = can(ctx.role, "VIEW_FINANCIALS");
  const showCost = can(ctx.role, "VIEW_FINANCIALS");
  const me = seeAll ? null : await db.employee.findFirst({ where: { orgId: ctx.orgId, email: ctx.user.email } });
  const opts = await options(ctx.orgId);
  const where = {
    orgId: ctx.orgId,
    date: { gte: period.from, lt: period.to },
    ...(seeAll ? (sp.employee ? { employeeId: sp.employee } : {}) : { employeeId: me?.id ?? "__none__" }),
    ...(sp.project ? { projectId: sp.project } : {}),
  };
  const entries = await db.timeEntry.findMany({ where, include: { employee: { select: { name: true } }, project: { select: { name: true } }, deliverable: { select: { title: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 500 });
  const total = sum(entries.map((e) => d(e.hours)));
  const billable = sum(entries.filter((e) => e.billable).map((e) => d(e.hours)));
  const oos = sum(entries.filter((e) => e.outOfScope).map((e) => d(e.hours)));
  const cost = sum(entries.map((e) => d(e.hours).times(d(e.costRate)).toDecimalPlaces(2)));
  const q = periodQuery(key, period);
  const dlOpts = opts.deliverables;
  return (
    <>
      <PageHeader title="Time tracking" description={`${seeAll ? "All team members" : "Your time"} · ${label}`} actions={<>
        <PeriodFilter value={key} />
        {showCost ? <LinkButton href={`/api/export/time?${q}`} variant="secondary" size="sm" prefetch={false}>Export CSV</LinkButton> : null}
        {seeAll ? <CsvImport entity="time" label="Import CSV" help="Columns: date (YYYY-MM-DD), employee_email, project, hours, work_type, billable (yes/no), out_of_scope (yes/no), notes. Project is matched by exact name." /> : null}
        <FormDialog testId="log-time" title="Log time" triggerLabel="Log time" action={saveTimeEntry} fields={timeFields(opts.employees, opts.projects, dlOpts, !seeAll)}
          defaults={{ date: isoDate(new Date()), workType: "PRODUCTION", billable: true, employeeId: sp.employee }} />
      </>} />
      {!seeAll && !me ? <div className="mb-4"><Note tone="warn">Your login ({ctx.user.email}) isn&apos;t linked to a team profile yet, so you can&apos;t log time. Ask an admin to add your email to your employee profile.</Note></div> : null}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hours logged" value={hours(total)} />
        <Stat label="Billable" value={hours(billable)} sub={total.gt(0) ? `${billable.div(total).times(100).toFixed(0)}% of logged` : undefined} />
        <Stat label="Out of scope" value={hours(oos)} tone={oos.gt(0) ? "warn" : undefined} />
        {showCost ? <Stat label="Labour cost" value={money(cost, ctx.org.currency)} sub="hours × loaded rate" /> : <Stat label="Entries" value={entries.length} />}
      </section>
      {seeAll ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterSelect param="employee" label="All team members" options={opts.employees} />
          <FilterSelect param="project" label="All projects" options={opts.projects} />
        </div>
      ) : null}
      <Card className="mt-4">
        <DataTable testId="time-table" rows={entries} rowKey={(e) => e.id} empty={<p className="px-5 py-8 text-center text-sm text-muted">No time logged in this period.</p>} columns={[
          { key: "d", header: "Date", primary: true, cell: (e) => `${date(e.date)}${seeAll ? ` · ${e.employee.name}` : ""}` },
          { key: "p", header: "Project", cell: (e) => e.project.name },
          { key: "dl", header: "Deliverable", hideOnMobile: true, cell: (e) => e.deliverable?.title ?? "—" },
          { key: "w", header: "Work", cell: (e) => <span className="flex flex-wrap gap-1">{titleCase(e.workType)}{!e.billable ? <Badge>Non-billable</Badge> : null}{e.outOfScope ? <Badge tone="loss">Out of scope</Badge> : null}</span> },
          { key: "h", header: "Hours", align: "right", highlight: true, cell: (e) => hours(e.hours) },
          ...(showCost ? [{ key: "c", header: "Cost", align: "right" as const, cell: (e: (typeof entries)[number]) => money(d(e.hours).times(d(e.costRate)), ctx.org.currency) }] : []),
          { key: "actions", header: "", cell: (e) => (
            <div className="flex justify-end">
              <FormDialog mode="edit" title="Edit time entry" action={saveTimeEntry} fields={[{ name: "id", label: "id", type: "hidden" }, ...timeFields(opts.employees, opts.projects, dlOpts, !seeAll)]}
                defaults={{ id: e.id, employeeId: e.employeeId, date: isoDate(e.date), projectId: e.projectId, deliverableId: e.deliverableId, hours: e.hours.toString(), workType: e.workType, billable: e.billable, outOfScope: e.outOfScope, notes: e.notes }} />
              <ConfirmAction action={deleteTimeEntry} payload={{ id: e.id }} label="Delete" title="Delete time entry?" description={`${e.hours} h on ${e.project.name} will be removed from project costs.`} />
            </div>) },
        ]} />
      </Card>
      {entries.length === 500 ? <p className="mt-2 text-[12px] text-subtle">Showing the latest 500 entries. Narrow the period or export CSV for everything.</p> : null}
    </>
  );
}
