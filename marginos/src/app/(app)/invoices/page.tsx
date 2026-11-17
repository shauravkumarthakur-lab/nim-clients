import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { resolvePeriod, periodQuery } from "@/lib/period";
import { loadOrgData } from "@/lib/finance/load";
import { options } from "@/lib/options";
import { nextInvoiceNumber } from "@/lib/numbering";
import { cashCollected, derivePaymentStatus, inPeriod, invoiceBalance, invoiceTotal, isRecognised, receivables, recognisedRevenue, sum, d } from "@/lib/finance/engine";
import { date, isoDate, money } from "@/lib/format";
import { PageHeader, Stat, Tabs } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { LinkButton } from "@/components/ui/button";
import { PeriodFilter } from "@/components/period-filter";
import { invoiceFields } from "@/components/forms";
import { saveInvoice } from "./actions";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const sp = await searchParams;
  const { key, period, label } = resolvePeriod(sp, "last_3_months");
  const data = await loadOrgData(ctx.orgId);
  const opts = await options(ctx.orgId);
  const cur = ctx.org.currency;
  const m = (v: Parameters<typeof money>[0]) => money(v, cur);
  const now = new Date();
  const pay = data.ds.payments;
  const status = sp.status ?? "period";
  const clientName = new Map(data.clients.map((c) => [c.id, c.name]));
  const enriched = data.invoices.map((i) => {
    const bal = invoiceBalance({ ...i }, pay);
    const overdue = bal.gt(0) && i.dueDate < now;
    return { i, total: invoiceTotal({ ...i }), bal, overdue, st: derivePaymentStatus({ ...i }, pay) };
  }).filter((r) => !sp.client || r.i.clientId === sp.client);
  const rows = enriched.filter((r) =>
    status === "outstanding" ? r.bal.gt(0) : status === "overdue" ? r.overdue : status === "draft" ? r.i.status === "DRAFT" : inPeriod(r.i.issueDate, period),
  ).sort((a, b) => b.i.issueDate.getTime() - a.i.issueDate.getTime());
  const recv = receivables(data.ds.invoices, pay, now);
  const age = (lo: number, hi: number) => sum(recv.filter((r) => r.daysOverdue >= lo && r.daysOverdue <= hi).map((r) => r.balance));
  const periodInv = data.invoices.filter((i) => isRecognised(i) && inPeriod(i.issueDate, period));
  const q = periodQuery(key, period);
  const manage = can(ctx.role, "MANAGE_FINANCE");
  return (
    <>
      <PageHeader title="Invoices & payments" description="Invoiced revenue, cash collected and receivables are tracked separately" actions={<>
        <PeriodFilter value={key} />
        <LinkButton href={`/api/export/invoices?${q}`} variant="secondary" size="sm" prefetch={false}>Export CSV</LinkButton>
        {manage ? <FormDialog testId="new-invoice" title="New invoice" triggerLabel="New invoice" action={saveInvoice} fields={invoiceFields(opts.clients, opts.projects)} wide
          defaults={{ number: await nextInvoiceNumber(ctx.orgId), issueDate: isoDate(now), dueDate: isoDate(new Date(now.getTime() + 15 * 86_400_000)), status: "DRAFT", taxAmount: "0", passThrough: "0", sharedWithClient: true, clientId: sp.client }} /> : null}
      </>} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="invoice-kpis">
        <Stat label="Invoiced revenue" value={m(recognisedRevenue(data.ds.invoices, period))} sub={`${label} · ex-tax`} />
        <Stat label="Tax invoiced" value={m(sum(periodInv.map((i) => d(i.taxAmount))))} sub="Not revenue" />
        <Stat label="Cash collected" value={m(cashCollected(pay, period))} sub="Incl. tax, net of refunds" />
        <Stat label="Outstanding" value={m(sum(recv.map((r) => r.balance)))} sub={`${recv.length} invoices`} href="/invoices?status=outstanding" />
        <Stat label="Overdue" value={m(sum(recv.filter((r) => r.daysOverdue > 0).map((r) => r.balance)))} tone="loss" href="/invoices?status=overdue" />
      </section>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <Tabs active={status} items={[
            { key: "period", href: `/invoices?${q}`, label: `Issued in period` }, { key: "outstanding", href: "/invoices?status=outstanding", label: "Outstanding" },
            { key: "overdue", href: "/invoices?status=overdue", label: "Overdue" }, { key: "draft", href: "/invoices?status=draft", label: "Drafts" },
          ]} />
          <Card>
            <DataTable testId="invoices-table" rows={rows} rowKey={(r) => r.i.id} rowHref={(r) => `/invoices/${r.i.id}`} empty={<p className="px-5 py-8 text-center text-sm text-muted">No invoices here.</p>} columns={[
              { key: "n", header: "Invoice", primary: true, cell: (r) => <span>{r.i.number}{Number(r.i.subtotal) < 0 ? <Badge className="ml-1">Credit note</Badge> : null}</span> },
              { key: "c", header: "Client", cell: (r) => clientName.get(r.i.clientId) },
              { key: "d", header: "Issued", cell: (r) => date(r.i.issueDate) },
              { key: "due", header: "Due", cell: (r) => <span className={r.overdue ? "text-loss" : ""}>{date(r.i.dueDate)}</span> },
              { key: "s", header: "Fee (revenue)", align: "right", hideOnMobile: true, cell: (r) => m(r.i.subtotal) },
              { key: "t", header: "Total", align: "right", cell: (r) => m(r.total) },
              { key: "b", header: "Balance", align: "right", highlight: true, cell: (r) => <span className={r.overdue ? "text-loss" : ""}>{m(r.bal)}</span> },
              { key: "st", header: "Status", cell: (r) => <span className="flex gap-1"><StatusBadge status={r.st} />{r.overdue ? <Badge tone="loss">Overdue</Badge> : null}</span> },
            ]} />
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader title="Receivables aging" description="As of today" />
          <CardBody className="text-[13px]">
            <dl className="grid grid-cols-[1fr_auto] gap-y-2">
              {[["Not yet due", age(0, 0)], ["1–30 days overdue", age(1, 30)], ["31–60 days", age(31, 60)], ["61–90 days", age(61, 90)], ["90+ days", age(91, 100000)]].map(([l, v]) => (
                <div key={String(l)} className="contents"><dt className="text-muted">{String(l)}</dt><dd className="num font-medium">{m(v as ReturnType<typeof d>)}</dd></div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
