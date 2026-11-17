import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { options } from "@/lib/options";
import { amountPaid, derivePaymentStatus, invoiceBalance, invoiceTotal } from "@/lib/finance/engine";
import { date, isoDate, money } from "@/lib/format";
import { PageHeader, Signed } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ActionButton, ConfirmAction, FormDialog } from "@/components/ui/form-dialog";
import { PrintButton } from "@/components/print-button";
import { Logo } from "@/components/logo";
import { invoiceFields } from "@/components/forms";
import { deleteInvoice, deletePayment, recordPayment, saveInvoice, setInvoiceStatus } from "../actions";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const { id } = await params;
  const inv = await db.invoice.findFirst({ where: { id, orgId: ctx.orgId }, include: { client: true, project: true, payments: { orderBy: { date: "asc" } } } });
  if (!inv) notFound();
  const opts = await options(ctx.orgId);
  const cur = ctx.org.currency;
  const m = (v: Parameters<typeof money>[0]) => money(v, cur, { decimals: true });
  const total = invoiceTotal({ ...inv });
  const paid = amountPaid(inv.id, inv.payments);
  const bal = invoiceBalance({ ...inv }, inv.payments);
  const st = derivePaymentStatus({ ...inv }, inv.payments);
  const manage = can(ctx.role, "MANAGE_FINANCE");
  return (
    <>
      <PageHeader back={{ href: "/invoices", label: "Invoices" }} title={<span className="flex items-center gap-2">{inv.number} <StatusBadge status={st} /></span>}
        description={<><Link href={`/clients/${inv.clientId}`} className="hover:underline">{inv.client.name}</Link>{inv.project ? <> · <Link className="hover:underline" href={`/projects/${inv.projectId}`}>{inv.project.name}</Link></> : null}</>}
        actions={<>
          <PrintButton />
          {manage && inv.status === "DRAFT" ? <ActionButton action={setInvoiceStatus} payload={{ id, status: "SENT" }} variant="primary" testId="mark-sent">Mark as sent</ActionButton> : null}
          {manage && inv.status !== "DRAFT" && inv.status !== "VOID" ? <FormDialog testId="record-payment" title="Record payment" triggerLabel="Record payment" action={recordPayment} description="Use a negative amount to record a refund."
            fields={[{ name: "invoiceId", label: "i", type: "hidden" }, { name: "date", label: "Payment date", type: "date", required: true }, { name: "amount", label: "Amount", type: "money", required: true }, { name: "method", label: "Method", type: "select", options: ["NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Cash", "Card", "Other"].map((x) => ({ value: x, label: x })) }, { name: "reference", label: "Reference / UTR" }]}
            defaults={{ invoiceId: id, date: isoDate(new Date()), amount: bal.toFixed(2), method: "NEFT" }} /> : null}
          {manage ? <FormDialog mode="edit" title="Edit invoice" action={saveInvoice} wide fields={[{ name: "id", label: "id", type: "hidden" }, ...invoiceFields(opts.clients, opts.projects)]}
            defaults={{ id, number: inv.number, clientId: inv.clientId, projectId: inv.projectId, issueDate: isoDate(inv.issueDate), dueDate: isoDate(inv.dueDate), subtotal: inv.subtotal.toString(), taxAmount: inv.taxAmount.toString(), passThrough: inv.passThrough.toString(), status: inv.status === "DRAFT" || inv.status === "VOID" ? inv.status : "SENT", description: inv.description, sharedWithClient: inv.sharedWithClient }} /> : null}
          {manage && inv.status === "DRAFT" ? <ConfirmAction action={deleteInvoice} payload={{ id }} label="Delete" title="Delete draft?" description="Drafts can be deleted. Sent invoices must be voided." /> : null}
          {manage && inv.status !== "DRAFT" && inv.status !== "VOID" && !inv.payments.length ? <ConfirmAction action={setInvoiceStatus} payload={{ id, status: "VOID" }} label="Void" title="Void invoice?" description="The invoice stays on record but no longer counts as revenue or receivable." confirmLabel="Void invoice" /> : null}
        </>} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><Logo /><p className="mt-2 text-[13px] text-muted">{ctx.org.name}</p></div>
              <div className="text-right text-[13px]"><p className="text-lg font-semibold">Invoice {inv.number}</p><p className="text-muted">Issued {date(inv.issueDate)} · Due {date(inv.dueDate)}</p></div>
            </div>
            <div className="mt-8 text-[13px]"><p className="text-subtle">Bill to</p><p className="font-medium">{inv.client.company ?? inv.client.name}</p><p className="text-muted">{inv.client.contactName}{inv.client.email ? ` · ${inv.client.email}` : ""}</p>{inv.client.address ? <p className="text-muted">{inv.client.address}</p> : null}</div>
            <table className="mt-8 w-full text-[13px]">
              <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-subtle"><th className="py-2 font-medium">Description</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
              <tbody>
                <tr className="border-b border-border"><td className="py-3">{inv.description ?? "Professional services"}</td><td className="num py-3 text-right">{m(inv.subtotal)}</td></tr>
                {Number(inv.passThrough) ? <tr className="border-b border-border"><td className="py-3">Media spend (reimbursable, pass-through)</td><td className="num py-3 text-right">{m(inv.passThrough)}</td></tr> : null}
              </tbody>
              <tfoot className="text-[13px]">
                <tr><td className="pt-3 text-right text-muted">Tax</td><td className="num pt-3 text-right">{m(inv.taxAmount)}</td></tr>
                <tr className="font-semibold"><td className="pt-1 text-right">Total</td><td className="num pt-1 text-right">{m(total)}</td></tr>
                <tr><td className="pt-1 text-right text-muted">Paid</td><td className="num pt-1 text-right">{m(paid)}</td></tr>
                <tr className="font-semibold"><td className="pt-1 text-right">Balance due</td><td className="num pt-1 text-right" data-testid="invoice-balance">{m(bal)}</td></tr>
              </tfoot>
            </table>
            <p className="mt-8 text-[11px] text-subtle">Management copy generated by MarginOS. This is not a statutory tax invoice.</p>
          </CardBody>
        </Card>
        <Card className="no-print self-start">
          <CardHeader title="Payments" description="Negative amounts are refunds" />
          <DataTable rows={inv.payments} rowKey={(p) => p.id} empty={<p className="px-5 py-6 text-sm text-muted">No payments yet.</p>} columns={[
            { key: "d", header: "Date", primary: true, cell: (p) => `${date(p.date)}${p.method ? ` · ${p.method}` : ""}` },
            { key: "r", header: "Reference", cell: (p) => p.reference ?? "—" },
            { key: "a", header: "Amount", align: "right", highlight: true, cell: (p) => <Signed value={Number(p.amount)}>{m(p.amount)}</Signed> },
            { key: "actions", header: "", cell: (p) => manage ? <div className="flex justify-end"><ConfirmAction action={deletePayment} payload={{ id: p.id }} label="Delete" title="Delete payment?" description="The invoice balance and status will be recalculated." /></div> : null },
          ]} />
        </Card>
      </div>
    </>
  );
}
