import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { resolvePeriod, periodQuery } from "@/lib/period";
import { options } from "@/lib/options";
import { d, sum } from "@/lib/finance/engine";
import { EXPENSE_KINDS } from "@/lib/constants";
import { date, isoDate, money } from "@/lib/format";
import { PageHeader, Stat, Signed } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ActionButton, ConfirmAction, FormDialog } from "@/components/ui/form-dialog";
import { LinkButton } from "@/components/ui/button";
import { PeriodFilter } from "@/components/period-filter";
import { FilterSelect } from "@/components/filter-select";
import { SearchBox } from "@/components/search-box";
import { CsvImport } from "@/components/csv-import";
import { DonutChart } from "@/components/charts/charts";
import { expenseFields } from "@/components/forms";
import { deleteExpense, markExpensePaid, postRecurring, saveExpense } from "./actions";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const sp = await searchParams;
  const { key, period, label } = resolvePeriod(sp, "this_month");
  const opts = await options(ctx.orgId);
  const cur = ctx.org.currency;
  const m = (v: Parameters<typeof money>[0]) => money(v, cur);
  const where: Prisma.ExpenseWhereInput = {
    orgId: ctx.orgId, date: { gte: period.from, lt: period.to },
    ...(sp.kind ? { category: { kind: sp.kind as never } } : {}),
    ...(sp.project ? { projectId: sp.project } : {}),
    ...(sp.type === "direct" ? { OR: [{ projectId: { not: null } }, { clientId: { not: null } }] } : sp.type === "overhead" ? { projectId: null, clientId: null } : {}),
    ...(sp.status ? { paymentStatus: sp.status as "PAID" | "UNPAID" } : {}),
    ...(sp.q ? { description: { contains: sp.q, mode: "insensitive" as const } } : {}),
  };
  const [rows, recurring] = await Promise.all([
    db.expense.findMany({ where, include: { category: true, vendor: true, project: { select: { name: true } }, client: { select: { name: true } }, freelancer: { select: { name: true } } }, orderBy: { date: "desc" }, take: 500 }),
    db.expense.findMany({ where: { orgId: ctx.orgId, isRecurring: true }, include: { category: true } }),
  ]);
  const total = sum(rows.map((r) => d(r.amount)));
  const direct = sum(rows.filter((r) => r.projectId || r.clientId).map((r) => d(r.amount)));
  const unpaid = sum(rows.filter((r) => r.paymentStatus === "UNPAID").map((r) => d(r.amount)));
  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.category.name, (byCat.get(r.category.name) ?? 0) + Number(r.amount));
  const manage = can(ctx.role, "MANAGE_FINANCE");
  const fields = expenseFields(opts);
  const q = periodQuery(key, period);
  return (
    <>
      <PageHeader title="Expenses" description={`${label} · direct costs are linked to a client/project, everything else is overhead`} actions={<>
        <PeriodFilter value={key} />
        <LinkButton href={`/api/export/expenses?${q}`} variant="secondary" size="sm" prefetch={false}>Export CSV</LinkButton>
        {manage ? <CsvImport entity="expenses" help="Columns: date (YYYY-MM-DD), amount, description, category, vendor, project, client, payment_status (PAID/UNPAID). Category/vendor/project/client are matched by exact name; category is required." /> : null}
        {manage ? <FormDialog testId="new-expense" title="Record expense" triggerLabel="Record expense" action={saveExpense} fields={fields} defaults={{ date: isoDate(new Date()), paymentStatus: "PAID", categoryId: sp.kind ? undefined : undefined }} wide /> : null}
      </>} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total expenses" value={m(total)} sub={`${rows.length} records`} />
        <Stat label="Direct (client/project)" value={m(direct)} />
        <Stat label="Overhead" value={m(total.minus(direct))} />
        <Stat label="Unpaid" value={m(unpaid)} tone={unpaid.gt(0) ? "warn" : undefined} href={`/expenses?${q}&status=UNPAID`} />
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        <SearchBox placeholder="Search descriptions" />
        <FilterSelect param="kind" label="All cost types" options={EXPENSE_KINDS} />
        <FilterSelect param="type" label="Direct & overhead" options={[{ value: "direct", label: "Direct only" }, { value: "overhead", label: "Overhead only" }]} />
        <FilterSelect param="project" label="All projects" options={opts.projects} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <DataTable testId="expenses-table" rows={rows} rowKey={(r) => r.id} empty={<p className="px-5 py-8 text-center text-sm text-muted">No expenses match.</p>} columns={[
            { key: "d", header: "Description", primary: true, cell: (r) => <span>{r.description}{r.outOfScope ? <Badge tone="loss" className="ml-1">Scope creep</Badge> : null}{r.recurringSourceId || r.isRecurring ? <Badge className="ml-1">Recurring</Badge> : null}</span> },
            { key: "dt", header: "Date", cell: (r) => date(r.date) },
            { key: "c", header: "Category", cell: (r) => r.category.name },
            { key: "a", header: "Allocated to", cell: (r) => r.project?.name ?? r.client?.name ?? <span className="text-subtle">Overhead</span> },
            { key: "v", header: "Payee", hideOnMobile: true, cell: (r) => r.freelancer?.name ?? r.vendor?.name ?? "—" },
            { key: "s", header: "Status", cell: (r) => <Badge tone={r.paymentStatus === "PAID" ? "gain" : "warn"}>{r.paymentStatus.toLowerCase()}</Badge> },
            { key: "amt", header: "Amount", align: "right", highlight: true, cell: (r) => <Signed value={Number(r.amount)}>{m(r.amount)}</Signed> },
            { key: "actions", header: "", cell: (r) => manage ? <div className="flex justify-end">
              {r.paymentStatus === "UNPAID" ? <ActionButton action={markExpensePaid} payload={{ id: r.id }} variant="ghost">Mark paid</ActionButton> : null}
              <FormDialog mode="edit" title="Edit expense" action={saveExpense} wide fields={[{ name: "id", label: "id", type: "hidden" }, ...fields]}
                defaults={{ id: r.id, date: isoDate(r.date), amount: r.amount.toString(), description: r.description, categoryId: r.categoryId, vendorId: r.vendorId, freelancerId: r.freelancerId, clientId: r.projectId ? null : r.clientId, projectId: r.projectId, deliverableId: r.deliverableId, paymentStatus: r.paymentStatus, recurringInterval: r.isRecurring ? r.recurringInterval : null, outOfScope: r.outOfScope }} />
              <ConfirmAction action={deleteExpense} payload={{ id: r.id }} label="Delete" title="Delete expense?" description={`${m(r.amount)} — ${r.description}`} />
            </div> : null },
          ]} />
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="By category" description={label} />
            <CardBody>{byCat.size ? <DonutChart currency={cur} data={[...byCat.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))} /> : <p className="text-sm text-muted">No data.</p>}</CardBody>
          </Card>
          <Card>
            <CardHeader title="Recurring expenses" description="Templates that repeat automatically" action={manage ? <ActionButton action={postRecurring} payload={{}} testId="post-recurring">Post due</ActionButton> : null} />
            <CardBody className="pt-2">
              {recurring.length ? <ul className="divide-y divide-border text-[13px]">{recurring.map((r) => <li key={r.id} className="flex justify-between gap-2 py-2"><span>{r.description} <span className="text-subtle">· {r.recurringInterval?.toLowerCase()}</span></span><span className="num">{m(r.amount)}</span></li>)}</ul>
                : <p className="text-sm text-muted">Mark an expense as recurring to add it here.</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
