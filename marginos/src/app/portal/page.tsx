import Link from "next/link";
import { requirePortalCtx } from "@/lib/tenant";
import { db } from "@/lib/db";
import { deliverableLabel } from "@/lib/constants";
import { derivePaymentStatus, invoiceBalance, invoiceTotal } from "@/lib/finance/engine";
import { date, money } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Bar } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { respondChangeRequest, reviewDeliverable } from "./actions";

export default async function PortalHome() {
  const ctx = await requirePortalCtx();
  const where = { orgId: ctx.orgId, clientId: ctx.clientId };
  const [projects, invoices, reports] = await Promise.all([
    db.project.findMany({ where: { ...where, sharedWithClient: true }, include: { deliverables: { where: { sharedWithClient: true }, orderBy: { dueDate: "desc" } }, scopeChanges: { where: { sharedWithClient: true, status: { in: ["QUOTED", "APPROVED", "INVOICED"] } }, orderBy: { requestedAt: "desc" } } }, orderBy: { startDate: "desc" } }),
    db.invoice.findMany({ where: { ...where, sharedWithClient: true, status: { notIn: ["DRAFT", "VOID"] } }, include: { payments: true }, orderBy: { issueDate: "desc" } }),
    db.sharedReport.findMany({ where, orderBy: { createdAt: "desc" }, select: { id: true, title: true, createdAt: true } }),
  ]);
  const cur = ctx.org.currency;
  const awaiting = projects.flatMap((p) => p.deliverables.filter((d) => d.status === "IN_REVIEW").map((d) => ({ ...d, projectName: p.name })));
  const changes = projects.flatMap((p) => p.scopeChanges.map((s) => ({ ...s, projectName: p.name })));
  return (
    <div className="mt-4 flex flex-col gap-5" data-testid="portal-home">
      <h1 className="text-2xl font-semibold tracking-tight">Your projects with {ctx.org.name}</h1>

      {awaiting.length ? (
        <Card><CardHeader title={`Awaiting your review (${awaiting.length})`} description="Approve, or tell the team what to change." />
          <CardBody className="pt-2"><ul className="divide-y divide-border" data-testid="portal-review">{awaiting.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span><b>{d.title}</b> <span className="text-muted">· {d.projectName} · {deliverableLabel(d.type)}</span></span>
              <span className="flex gap-2">
                <FormDialog title="Approve deliverable" triggerLabel="Approve" triggerVariant="brand" testId="portal-approve" action={reviewDeliverable} submitLabel="Approve"
                  fields={[{ name: "id", label: "id", type: "hidden" }, { name: "decision", label: "d", type: "hidden" }, { name: "feedback", label: "Comment (optional)", type: "textarea" }]} defaults={{ id: d.id, decision: "APPROVE" }} />
                <FormDialog title="Request changes" triggerLabel="Request changes" triggerVariant="secondary" testId="portal-changes" action={reviewDeliverable} submitLabel="Send to team"
                  fields={[{ name: "id", label: "id", type: "hidden" }, { name: "decision", label: "d", type: "hidden" }, { name: "feedback", label: "What should change?", type: "textarea", required: true }]} defaults={{ id: d.id, decision: "CHANGES" }} />
              </span>
            </li>))}</ul></CardBody></Card>
      ) : null}

      {changes.length ? (
        <Card><CardHeader title="Additional work & change requests" description="Work outside the original agreement, with its quotation." />
          <DataTable testId="portal-changes-table" rows={changes} rowKey={(s) => s.id} columns={[
            { key: "t", header: "Request", primary: true, cell: (s) => `${s.changeRequestNo ?? ""} ${s.title}` },
            { key: "p", header: "Project", cell: (s) => s.projectName },
            { key: "a", header: "Quoted", align: "right", highlight: true, cell: (s) => (s.quotedAmount ? money(s.quotedAmount, cur) : "—") },
            { key: "s", header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
            { key: "actions", header: "", cell: (s) => s.status === "QUOTED" ? <div className="flex justify-end gap-2">
              <FormDialog title={`Approve ${s.changeRequestNo ?? "change request"}?`} description={`You agree to the additional fee of ${money(s.quotedAmount, cur)} (plus applicable tax) for: ${s.title}.`} triggerLabel="Approve" triggerVariant="brand" testId="portal-approve-cr" action={respondChangeRequest} submitLabel="Approve quotation"
                fields={[{ name: "id", label: "id", type: "hidden" }, { name: "decision", label: "d", type: "hidden" }, { name: "note", label: "Note (optional)", type: "textarea" }]} defaults={{ id: s.id, decision: "APPROVE" }} />
              <FormDialog title="Decline change request" triggerLabel="Decline" triggerVariant="secondary" action={respondChangeRequest} submitLabel="Decline"
                fields={[{ name: "id", label: "id", type: "hidden" }, { name: "decision", label: "d", type: "hidden" }, { name: "note", label: "Reason (optional)", type: "textarea" }]} defaults={{ id: s.id, decision: "REJECT" }} />
            </div> : null },
          ]} /></Card>
      ) : null}

      {projects.length ? projects.map((p) => {
        const total = p.deliverables.reduce((a, d) => a + d.quantityContracted, 0);
        const done = p.deliverables.reduce((a, d) => a + Math.min(d.quantityCompleted, d.quantityContracted), 0);
        return (
          <Card key={p.id} data-testid="portal-project">
            <CardHeader title={<span className="flex items-center gap-2">{p.name} <StatusBadge status={p.status} /></span>} description={`${date(p.startDate)} → ${date(p.endDate)}`} />
            <CardBody className="pt-3">
              <div className="mb-1 flex justify-between text-[13px]"><span>Progress on shared deliverables</span><span className="num">{done} / {total}</span></div>
              <Bar value={done} max={total || 1} className="h-2" />
            </CardBody>
            <DataTable rows={p.deliverables} rowKey={(d) => d.id} empty={<p className="px-5 pb-5 text-sm text-muted">No deliverables shared yet.</p>} columns={[
              { key: "t", header: "Deliverable", primary: true, cell: (d) => d.title },
              { key: "ty", header: "Type", cell: (d) => deliverableLabel(d.type) },
              { key: "q", header: "Agreed / done", align: "right", cell: (d) => `${d.quantityContracted} / ${d.quantityCompleted}` },
              { key: "due", header: "Due", cell: (d) => date(d.dueDate) },
              { key: "s", header: "Status", highlight: true, cell: (d) => <StatusBadge status={d.status} /> },
              { key: "f", header: "Your feedback", hideOnMobile: true, cell: (d) => <span className="line-clamp-2 text-[12px] text-muted">{d.clientFeedback ?? ""}</span> },
            ]} />
          </Card>
        );
      }) : <Card><CardBody><p className="text-sm text-muted">No projects have been shared with you yet.</p></CardBody></Card>}

      <Card><CardHeader title="Invoices & payments" />
        <DataTable testId="portal-invoices" rows={invoices} rowKey={(i) => i.id} empty={<p className="px-5 pb-5 text-sm text-muted">No invoices.</p>} columns={[
          { key: "n", header: "Invoice", primary: true, cell: (i) => i.number },
          { key: "d", header: "Issued", cell: (i) => date(i.issueDate) },
          { key: "due", header: "Due", cell: (i) => date(i.dueDate) },
          { key: "t", header: "Total", align: "right", cell: (i) => money(invoiceTotal({ ...i }), cur) },
          { key: "b", header: "Balance", align: "right", highlight: true, cell: (i) => money(invoiceBalance({ ...i }, i.payments), cur) },
          { key: "s", header: "Status", cell: (i) => <StatusBadge status={derivePaymentStatus({ ...i }, i.payments)} /> },
        ]} /></Card>

      <Card><CardHeader title="Reports shared with you" />
        <CardBody className="pt-2">{reports.length ? <ul className="divide-y divide-border text-sm">{reports.map((r) => <li key={r.id} className="py-2"><Link href={`/portal/reports/${r.id}`} className="font-medium hover:underline">{r.title}</Link> <span className="text-muted">· shared {date(r.createdAt)}</span></li>)}</ul> : <p className="text-sm text-muted">No reports yet.</p>}</CardBody></Card>
      <p className="text-[11px] text-subtle">You only see items {ctx.org.name} has chosen to share with {""}your organisation. <Badge>Secure portal</Badge></p>
    </div>
  );
}
