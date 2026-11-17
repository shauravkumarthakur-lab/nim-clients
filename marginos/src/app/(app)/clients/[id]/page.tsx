import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { resolvePeriod, periodQuery } from "@/lib/period";
import { loadOrgData } from "@/lib/finance/load";
import { clientRows, projectRows } from "@/lib/finance/analytics";
import { addMonths, derivePaymentStatus, invoiceBalance, invoiceTotal, monthStart, priceForTargetMargin, d } from "@/lib/finance/engine";
import { options } from "@/lib/options";
import { date, isoDate, money, pct, hours, titleCase } from "@/lib/format";
import { PageHeader, Stat, Signed, Note } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmAction, FormDialog } from "@/components/ui/form-dialog";
import { PeriodFilter } from "@/components/period-filter";
import { RevenueExpenseChart, DonutChart } from "@/components/charts/charts";
import { clientFields } from "@/components/forms";
import { deleteClient, saveClient } from "../actions";
import { inviteMember } from "../../settings/actions";
import { shareClientReport } from "../../reports/actions";

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const { id } = await params;
  const sp = await searchParams;
  const client = await db.client.findFirst({ where: { id, orgId: ctx.orgId }, include: { accountManager: true, portalUsers: { include: { user: { select: { email: true, name: true } } } } } });
  if (!client) notFound();
  const { key, period, label } = resolvePeriod(sp, "last_3_months");
  const q = periodQuery(key, period);
  const data = await loadOrgData(ctx.orgId);
  const opts = await options(ctx.orgId);
  const cur = ctx.org.currency;
  const m = (v: Parameters<typeof money>[0]) => money(v, cur);
  const row = clientRows(data, period, ctx.org.overheadMethod).find((r) => r.clientId === id)!;
  const projects = projectRows(data).filter((p) => p.project.clientId === id);
  const invoices = data.invoices.filter((i) => i.clientId === id).sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
  const ds = data.ds;
  const trend = Array.from({ length: 6 }, (_, i) => {
    const from = addMonths(monthStart(new Date()), i - 5);
    const r = clientRows(data, { from, to: addMonths(from, 1) }, ctx.org.overheadMethod).find((x) => x.clientId === id)!;
    return { month: from.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }), revenue: r.revenue.toNumber(), expenses: r.directCosts.toNumber(), netProfit: r.contributionProfit.toNumber() };
  });
  const target = d(ctx.org.targetMarginPct);
  const neededFee = priceForTargetMargin(row.directCosts, target);
  const manage = can(ctx.role, "MANAGE_WORK");

  return (
    <>
      <PageHeader back={{ href: `/clients?${q}`, label: "Clients" }} title={<span className="flex flex-wrap items-center gap-2">{client.name} <StatusBadge status={client.status} /></span>}
        description={[client.industry, client.accountManager ? `Account manager: ${client.accountManager.name}` : null, `${titleCase(client.billingFrequency)} · ${m(client.contractValue)}`].filter(Boolean).join(" · ")}
        actions={<>
          <PeriodFilter value={key} />
          {manage ? <FormDialog mode="edit" title="Edit client" action={saveClient} fields={[{ name: "id", label: "id", type: "hidden" }, ...clientFields(opts.employees)]}
            defaults={{ ...client, id: client.id, contractValue: client.contractValue.toString(), contractStart: isoDate(client.contractStart), contractEnd: isoDate(client.contractEnd) } as never} wide testId="edit-client" /> : null}
          {manage ? <ConfirmAction action={deleteClient} payload={{ id }} label="Delete" title="Delete client?" description="This permanently deletes the client and its projects. Clients with invoices cannot be deleted — mark them churned instead." confirmLabel="Delete client" /> : null}
        </>} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" data-testid="client-kpis">
        <Stat label="Revenue" value={m(row.revenue)} sub={label} />
        <Stat label="Collected" value={m(row.cashCollected)} />
        <Stat label="Direct costs" value={m(row.directCosts)} sub={hours(row.hours)} />
        <Stat label="Contribution" value={m(row.contributionProfit)} tone={row.contributionProfit.lt(0) ? "loss" : "gain"} />
        <Stat label="Margin" value={pct(row.contributionMarginPct)} tone={row.contributionMarginPct?.lt(target) ? "warn" : undefined} sub={`Target ${pct(target, 0)}`} />
        <Stat label="Overhead share" value={m(row.allocatedOverhead)} />
        <Stat label="Net profit" value={m(row.netProfit)} tone={row.netProfit.lt(0) ? "loss" : undefined} />
      </section>

      {row.revenue.gt(0) && row.contributionMarginPct && row.contributionMarginPct.lt(target) && neededFee ? (
        <div className="mt-4"><Note tone="warn">
          This client is below your {pct(target, 0)} target margin. At the current cost to serve ({m(row.directCosts)} for {label.toLowerCase()}), fees of about <b>{m(neededFee)}</b> for the same period would be needed — {pct(neededFee.minus(row.revenue).div(row.revenue).times(100))} more than billed. <span className="opacity-75">(Estimate: assumes the same scope and costs.)</span>
        </Note></div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Profitability trend" description="Revenue vs direct costs, last 6 months · line = contribution" />
          <CardBody><RevenueExpenseChart data={trend} currency={cur} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Cost to serve" description={label} />
          <CardBody>
            {row.directCosts.gt(0) ? <DonutChart currency={cur} data={[
              { name: "Team time", value: row.directLabour.toNumber() }, { name: "Freelancers", value: row.freelancerCost.toNumber() },
              { name: "Production & travel", value: row.productionCost.toNumber() }, { name: "Other direct", value: row.otherDirectCost.toNumber() },
            ].filter((x) => x.value > 0)} /> : <p className="text-sm text-muted">No direct costs in this period.</p>}
            {row.outOfScopeCost.gt(0) ? <p className="mt-2 text-[13px] text-loss">{m(row.outOfScopeCost)} of this was out-of-scope work.</p> : null}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Projects" description="Lifetime project economics" />
        <DataTable rows={projects} rowKey={(r) => r.project.id} rowHref={(r) => `/projects/${r.project.id}`}
          columns={[
            { key: "n", header: "Project", primary: true, cell: (r) => r.project.name },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.project.status} /> },
            { key: "cv", header: "Contract", align: "right", cell: (r) => m(r.project.contractValue) },
            { key: "rev", header: "Invoiced", align: "right", cell: (r) => m(r.pp.revenue) },
            { key: "c", header: "Cost", align: "right", cell: (r) => m(r.pp.totalCost) },
            { key: "b", header: "Budget used", align: "right", cell: (r) => <Badge tone={r.pp.budgetState === "OVER" ? "loss" : r.pp.budgetState === "WARNING" ? "warn" : "neutral"}>{pct(r.pp.budgetUsedPct, 0)}</Badge> },
            { key: "pm", header: "Projected margin", align: "right", highlight: true, cell: (r) => <Signed value={r.pp.projectedMarginPct?.toNumber()}>{pct(r.pp.projectedMarginPct)}</Signed> },
          ]} />
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Invoices" action={<Link href={`/invoices?client=${id}`} className="text-[13px] text-muted hover:text-fg">View all</Link>} />
          <DataTable rows={invoices.slice(0, 10)} rowKey={(i) => i.id} rowHref={(i) => `/invoices/${i.id}`}
            columns={[
              { key: "n", header: "Number", primary: true, cell: (i) => i.number },
              { key: "d", header: "Issued", cell: (i) => date(i.issueDate) },
              { key: "t", header: "Total", align: "right", cell: (i) => m(invoiceTotal({ ...i, status: i.status })) },
              { key: "b", header: "Balance", align: "right", highlight: true, cell: (i) => m(invoiceBalance({ ...i }, ds.payments)) },
              { key: "s", header: "Status", cell: (i) => <StatusBadge status={derivePaymentStatus({ ...i }, ds.payments)} /> },
            ]} />
        </Card>
        <Card>
          <CardHeader title="Contact & client portal" />
          <CardBody className="text-[13px]">
            <dl className="grid grid-cols-[110px_1fr] gap-y-1.5">
              <dt className="text-subtle">Contact</dt><dd>{client.contactName ?? "—"}</dd>
              <dt className="text-subtle">Email</dt><dd className="break-all">{client.email ?? "—"}</dd>
              <dt className="text-subtle">Phone</dt><dd>{client.phone ?? "—"}</dd>
              <dt className="text-subtle">Contract</dt><dd>{date(client.contractStart)} → {date(client.contractEnd)}</dd>
            </dl>
            <div className="mt-4 border-t border-border pt-4">
              <p className="font-medium">Portal users</p>
              {client.portalUsers.length ? <ul className="mt-1 text-muted">{client.portalUsers.map((u) => <li key={u.id}>{u.user.name} · {u.user.email}</li>)}</ul> : <p className="mt-1 text-muted">No one from this client has portal access.</p>}
              {can(ctx.role, "MANAGE_ORG") ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <FormDialog title="Invite to client portal" triggerLabel="Invite portal user" triggerVariant="secondary" action={inviteMember} testId="invite-portal"
                    description="They will only see items you explicitly share for this client."
                    fields={[{ name: "email", label: "Email", type: "email", required: true, full: true }, { name: "role", label: "role", type: "hidden" }, { name: "clientId", label: "client", type: "hidden" }]}
                    defaults={{ role: "CLIENT", clientId: id, email: client.email ?? "" }} submitLabel="Send invitation" />
                  <FormDialog title="Share report with client" triggerLabel="Share report" triggerVariant="secondary" action={shareClientReport} testId="share-report"
                    description="Shares a snapshot of delivery progress, deliverables and invoices for the period. Internal costs and margins are never shared."
                    fields={[{ name: "clientId", label: "c", type: "hidden" }, { name: "title", label: "Report title", required: true, full: true }, { name: "from", label: "From", type: "date", required: true }, { name: "to", label: "To", type: "date", required: true }]}
                    defaults={{ clientId: id, title: `Delivery report — ${label}`, from: isoDate(period.from), to: isoDate(new Date(period.to.getTime() - 86_400_000)) }} submitLabel="Share" />
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
