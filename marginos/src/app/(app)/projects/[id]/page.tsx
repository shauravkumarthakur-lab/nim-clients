import { notFound } from "next/navigation";
import Link from "next/link";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { loadOrgData } from "@/lib/finance/load";
import { deliverableEconomics, projectAlerts, projectProfitability, scopeCreep, d } from "@/lib/finance/engine";
import { options } from "@/lib/options";
import { deliverableLabel, SCOPE_TYPES } from "@/lib/constants";
import { date, isoDate, money, pct, hours, titleCase } from "@/lib/format";
import { PageHeader, Stat, Signed, Bar } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmAction, FormDialog } from "@/components/ui/form-dialog";
import { DonutChart } from "@/components/charts/charts";
import { deliverableFields, projectFields, scopeFields, timeFields } from "@/components/forms";
import { deleteAssignment, deleteDeliverable, deleteProject, saveAssignment, saveDeliverable, saveProject } from "../actions";
import { saveScopeChange } from "../../scope/actions";
import { ScopeActions } from "../../scope/scope-actions";
import { saveTimeEntry } from "../../time/actions";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, orgId: ctx.orgId },
    include: { client: true, manager: true, assignments: { include: { employee: true, freelancer: true } } },
  });
  if (!project) notFound();
  const data = await loadOrgData(ctx.orgId);
  const opts = await options(ctx.orgId);
  const cur = ctx.org.currency;
  const m = (v: Parameters<typeof money>[0]) => money(v, cur);
  const pin = data.projectsIn.find((p) => p.id === id)!;
  const pp = projectProfitability(pin, data.ds, data.scopeIn);
  const dls = data.deliverablesIn.filter((x) => x.projectId === id);
  const dlRaw = new Map(data.deliverables.map((x) => [x.id, x]));
  const econ = dls.map((dl) => ({ dl: dlRaw.get(dl.id)!, e: deliverableEconomics(dl, data.ds.timeEntries, data.ds.expenses, project.revisionLimit) }));
  const scope = data.scope.filter((s) => s.projectId === id).sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  const sc = scopeCreep([id], data.ds.timeEntries, data.ds.expenses, data.scopeIn, data.deliverablesIn, { [id]: project.revisionLimit });
  const alerts = projectAlerts(pin, pp, data.deliverablesIn, data.scopeIn, ctx.org.targetMarginPct);
  const recentTime = data.timeEntries.filter((t) => t.projectId === id).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 12);
  const empName = new Map(data.employees.map((e) => [e.id, e.name]));
  const expenses = data.expenses.filter((e) => e.projectId === id).sort((a, b) => b.date.getTime() - a.date.getTime());
  const manage = can(ctx.role, "MANAGE_WORK");
  const target = d(project.targetMarginPct ?? ctx.org.targetMarginPct);
  const dlOpts = data.deliverables.filter((x) => x.projectId === id).map((x) => ({ value: x.id, label: x.title }));
  const loggedByEmp = new Map<string, number>();
  for (const t of data.timeEntries.filter((t) => t.projectId === id)) loggedByEmp.set(t.employeeId, (loggedByEmp.get(t.employeeId) ?? 0) + Number(t.hours));
  const flSpend = new Map<string, number>();
  for (const e of expenses) if (e.freelancerId) flSpend.set(e.freelancerId, (flSpend.get(e.freelancerId) ?? 0) + Number(e.amount));

  return (
    <>
      <PageHeader back={{ href: "/projects", label: "Projects" }}
        title={<span className="flex flex-wrap items-center gap-2">{project.name} <StatusBadge status={project.status} />{project.sharedWithClient ? <Badge tone="info">Shared with client</Badge> : null}</span>}
        description={<><Link href={`/clients/${project.clientId}`} className="hover:underline">{project.client.name}</Link>{project.manager ? ` · PM: ${project.manager.name}` : ""} · {date(project.startDate)} → {date(project.endDate)}</>}
        actions={<>
          {can(ctx.role, "LOG_TIME") ? <FormDialog title="Log time" triggerLabel="Log time" triggerVariant="secondary" action={saveTimeEntry} testId="project-log-time"
            fields={timeFields(opts.employees, opts.projects, dlOpts)} defaults={{ projectId: id, date: isoDate(new Date()), workType: "PRODUCTION", billable: true }} /> : null}
          {manage ? <FormDialog mode="edit" title="Edit project" action={saveProject} wide testId="edit-project" fields={[{ name: "id", label: "id", type: "hidden" }, ...projectFields(opts.clients, opts.employees)]}
            defaults={{ id, name: project.name, clientId: project.clientId, managerId: project.managerId, contractValue: project.contractValue.toString(), budget: project.budget.toString(), budgetHours: project.budgetHours.toString(), targetMarginPct: project.targetMarginPct?.toString(), startDate: isoDate(project.startDate), endDate: isoDate(project.endDate), revisionLimit: String(project.revisionLimit), status: project.status, description: project.description, sharedWithClient: project.sharedWithClient }} /> : null}
          {manage ? <ConfirmAction action={deleteProject} payload={{ id }} label="Delete" title="Delete project?" description="Deletes the project with its deliverables, time entries and scope log. Projects with invoices can't be deleted." confirmLabel="Delete project" /> : null}
        </>} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="project-kpis">
        <Stat label="Contract value" value={m(project.contractValue)} sub={pp.approvedChangeValue.gt(0) ? `+ ${m(pp.approvedChangeValue)} approved changes` : "No approved changes"} />
        <Stat label="Invoiced revenue" value={m(pp.revenue)} />
        <Stat label="Actual cost" value={m(pp.totalCost)} sub={`${m(pp.labourCost)} team · ${m(pp.externalCost)} external`} />
        <Stat label="Profit to date" value={m(pp.profit)} tone={pp.profit.lt(0) ? "loss" : undefined} sub={`${pct(pp.marginPct)} on invoiced`} />
        <Stat label="Projected margin" value={pct(pp.projectedMarginPct)} tone={pp.projectedMarginPct && pp.projectedMarginPct.lt(target) ? "loss" : "gain"} sub={`Target ${pct(target, 0)}`} />
        <Stat label="Scope creep" value={m(sc.outOfScopeCost)} tone={sc.unrecovered.gt(0) ? "loss" : undefined} sub={`${m(sc.recovered)} recovered`} />
      </section>

      {alerts.length ? (
        <Card className="mt-4"><CardBody className="py-3">
          <ul className="flex flex-col gap-1.5 text-[13px]" data-testid="project-alerts">
            {alerts.map((a, i) => <li key={i} className="flex items-start gap-2">{a.severity === "high" ? <CircleAlert size={15} className="mt-0.5 shrink-0 text-loss" /> : <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" />}{a.message}</li>)}
          </ul>
        </CardBody></Card>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Budget vs actual" />
          <CardBody className="flex flex-col gap-5 text-[13px]">
            {[
              { l: "Cost", used: pp.totalCost.toNumber(), of: project.budget.toNumber(), fmt: m, p: pp.budgetUsedPct },
              { l: "Hours", used: pp.hours.toNumber(), of: project.budgetHours.toNumber(), fmt: (x: number) => hours(x), p: pp.hoursUsedPct },
            ].map((r) => (
              <div key={r.l}>
                <div className="mb-1.5 flex justify-between"><span className="font-medium">{r.l}</span><span className="num">{r.fmt(r.used)} of {r.of ? r.fmt(r.of) : "— (no budget)"} · {pct(r.p, 0)}</span></div>
                <Bar value={r.p?.toNumber() ?? 0} tone={r.p && r.p.gt(100) ? "loss" : r.p && r.p.gte(90) ? "warn" : "brand"} className="h-2" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[["Team time", pp.labourCost], ["Freelancers", pp.freelancerCost], ["Equipment", pp.equipmentCost], ["Production", pp.productionCost], ["Travel", pp.travelCost], ["Software", pp.softwareCost], ["Other", pp.otherCost], ["Budget variance", pp.budgetVariance]].map(([l, v]) => (
                <div key={String(l)} className="rounded-lg bg-surface-2 p-2.5"><p className="text-[11px] text-subtle">{String(l)}</p><p className={`num font-medium ${(v as typeof pp.budgetVariance).lt(0) ? "text-loss" : ""}`}>{m(v as typeof pp.budgetVariance)}</p></div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Cost breakdown" />
          <CardBody>{pp.totalCost.gt(0) ? <DonutChart currency={cur} data={[["Team time", pp.labourCost], ["Freelancers", pp.freelancerCost], ["Equipment", pp.equipmentCost], ["Production", pp.productionCost], ["Travel", pp.travelCost], ["Other", pp.softwareCost.plus(pp.otherCost)]].map(([n, v]) => ({ name: String(n), value: (v as typeof pp.labourCost).toNumber() })).filter((x) => x.value > 0)} /> : <p className="text-sm text-muted">No costs recorded yet.</p>}</CardBody>
        </Card>
      </div>

      <Card className="mt-5" id="deliverables">
        <CardHeader title="Deliverables" description="Cost, revenue and profit per deliverable" action={manage ? <FormDialog title="Add deliverable" triggerLabel="Add deliverable" action={saveDeliverable} testId="new-deliverable" fields={deliverableFields(null).concat([{ name: "projectId", label: "p", type: "hidden" }])} defaults={{ projectId: id, type: "REEL", status: "NOT_STARTED", quantityContracted: "1", quantityCompleted: "0", revisionCount: "0", shootDays: "0", revenueAllocation: "0" }} wide /> : null} />
        <DataTable testId="deliverables-table" rows={econ} rowKey={(r) => r.dl.id}
          columns={[
            { key: "t", header: "Deliverable", primary: true, cell: (r) => <span>{r.dl.title}{r.dl.outOfScope ? <Badge tone="loss" className="ml-1.5">Out of scope</Badge> : null}</span> },
            { key: "ty", header: "Type", cell: (r) => deliverableLabel(r.dl.type) },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.dl.status} /> },
            { key: "q", header: "Done / qty", align: "right", cell: (r) => `${r.dl.quantityCompleted} / ${r.dl.quantityContracted}` },
            { key: "rv", header: "Revisions", align: "right", cell: (r) => <span className={r.e.revisionsOverLimit ? "text-loss" : ""}>{r.dl.revisionCount} / {r.dl.revisionLimit ?? project.revisionLimit}</span> },
            { key: "h", header: "Hours", align: "right", hideOnMobile: true, cell: (r) => hours(r.e.totalHours) },
            { key: "c", header: "Cost", align: "right", cell: (r) => m(r.e.totalCost) },
            { key: "cu", header: "Cost / unit", align: "right", cell: (r) => m(r.e.costPerUnit) },
            { key: "p", header: "Profit", align: "right", highlight: true, cell: (r) => <Signed value={r.e.profit.toNumber()}>{m(r.e.profit)}</Signed> },
            { key: "actions", header: "", cell: (r) => manage ? <div className="flex justify-end">
              <FormDialog mode="edit" title="Edit deliverable" action={saveDeliverable} wide fields={[{ name: "id", label: "id", type: "hidden" }, { name: "projectId", label: "p", type: "hidden" }, ...deliverableFields(null)]}
                defaults={{ id: r.dl.id, projectId: id, title: r.dl.title, type: r.dl.type, status: r.dl.status, quantityContracted: String(r.dl.quantityContracted), quantityCompleted: String(r.dl.quantityCompleted), revisionCount: String(r.dl.revisionCount), revisionLimit: r.dl.revisionLimit?.toString(), shootDays: r.dl.shootDays.toString(), revenueAllocation: r.dl.revenueAllocation.toString(), dueDate: isoDate(r.dl.dueDate), outOfScope: r.dl.outOfScope, sharedWithClient: r.dl.sharedWithClient }} />
              <ConfirmAction action={deleteDeliverable} payload={{ id: r.dl.id }} label="Delete" title="Delete deliverable?" description="Time and expenses linked to it stay on the project." />
            </div> : null },
          ]} />
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card id="scope">
          <CardHeader title="Scope changes & change requests" description={`${sc.pendingCount} pending · ${hours(sc.outOfScopeHours)} out-of-scope work · ${m(sc.unrecovered)} unrecovered`}
            action={manage ? <FormDialog title="Log scope change" triggerLabel="Log request" triggerVariant="secondary" action={saveScopeChange} testId="new-scope" fields={[{ name: "projectId", label: "p", type: "hidden" }, ...scopeFields(null, dlOpts)]} defaults={{ projectId: id, type: "ADDITIONAL_DELIVERABLE", requestedAt: isoDate(new Date()) }} wide /> : null} />
          <CardBody className="pt-2">
            {scope.length ? (
              <ul className="divide-y divide-border" data-testid="scope-list">
                {scope.map((s) => (
                  <li key={s.id} className="py-3 text-[13px]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="font-medium">{s.changeRequestNo ? <span className="text-subtle">{s.changeRequestNo} · </span> : null}{s.title}</p>
                        <p className="text-[12px] text-muted">{SCOPE_TYPES.find((t) => t.value === s.type)?.label} · {date(s.requestedAt)} · est. {hours(s.estimatedHours)} / {m(s.estimatedCost)}{s.quotedAmount ? ` · quoted ${m(s.quotedAmount)}` : ""}</p></div>
                      <StatusBadge status={s.status} />
                    </div>
                    {manage ? <div className="mt-2"><ScopeActions s={{ id: s.id, status: s.status, quotedAmount: s.quotedAmount?.toString() ?? null, estimatedCost: s.estimatedCost.toString(), sharedWithClient: s.sharedWithClient }} /></div> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No scope changes logged.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Team & freelancers" action={manage ? <FormDialog title="Assign to project" triggerLabel="Assign" triggerVariant="secondary" action={saveAssignment} testId="assign"
            fields={[{ name: "projectId", label: "p", type: "hidden" }, { name: "employeeId", label: "Team member", type: "select", options: opts.employees }, { name: "freelancerId", label: "…or freelancer", type: "select", options: opts.freelancers }, { name: "role", label: "Role on project" }, { name: "allocatedHours", label: "Allocated hours", type: "hours" }]}
            defaults={{ projectId: id }} /> : null} />
          <DataTable rows={project.assignments} rowKey={(a) => a.id} empty={<p className="px-5 py-6 text-sm text-muted">Nobody assigned yet.</p>}
            columns={[
              { key: "n", header: "Name", primary: true, cell: (a) => a.employee ? <Link href={`/team/${a.employee.id}`} className="hover:underline">{a.employee.name}</Link> : <span>{a.freelancer?.name} <Badge>Freelancer</Badge></span> },
              { key: "r", header: "Role", cell: (a) => a.role ?? "—" },
              { key: "al", header: "Allocated", align: "right", cell: (a) => hours(a.allocatedHours) },
              { key: "lg", header: "Logged / spend", align: "right", highlight: true, cell: (a) => a.employeeId ? hours(loggedByEmp.get(a.employeeId) ?? 0) : m(flSpend.get(a.freelancerId!) ?? 0) },
              { key: "actions", header: "", cell: (a) => manage ? <div className="flex justify-end"><ConfirmAction action={deleteAssignment} payload={{ id: a.id }} label="Remove" title="Remove from project?" description="Logged time and costs are kept." /></div> : null },
            ]} />
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent time" action={<Link href={`/time?project=${id}`} className="text-[13px] text-muted hover:text-fg">All time</Link>} />
          <DataTable rows={recentTime} rowKey={(t) => t.id} columns={[
            { key: "d", header: "Date", primary: true, cell: (t) => `${date(t.date)} · ${empName.get(t.employeeId)}` },
            { key: "w", header: "Work", cell: (t) => <span>{titleCase(t.workType)}{t.outOfScope ? <Badge tone="loss" className="ml-1">Out of scope</Badge> : null}</span> },
            { key: "h", header: "Hours", align: "right", highlight: true, cell: (t) => hours(t.hours) },
            { key: "c", header: "Cost", align: "right", cell: (t) => m(d(t.hours).times(d(t.costRate))) },
          ]} />
        </Card>
        <Card>
          <CardHeader title="Expenses" action={<Link href={`/expenses?project=${id}`} className="text-[13px] text-muted hover:text-fg">All expenses</Link>} />
          <DataTable rows={expenses.slice(0, 12)} rowKey={(e) => e.id} columns={[
            { key: "d", header: "Description", primary: true, cell: (e) => e.description },
            { key: "c", header: "Category", cell: (e) => e.category.name },
            { key: "dt", header: "Date", cell: (e) => date(e.date) },
            { key: "a", header: "Amount", align: "right", highlight: true, cell: (e) => <Signed value={Number(e.amount)}>{m(e.amount)}</Signed> },
          ]} />
        </Card>
      </div>
    </>
  );
}
