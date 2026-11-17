import { notFound } from "next/navigation";
import { requirePortalCtx } from "@/lib/tenant";
import { db } from "@/lib/db";
import { date, money } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PrintButton } from "@/components/print-button";

type Payload = { projects: { name: string; status: string; deliverables: { title: string; type: string; status: string; completed: number; contracted: number }[]; approvedChanges: { ref: string | null; title: string; amount: string | null }[] }[]; invoices: { number: string; issueDate: string; total: string; balance: string; status: string }[] };

export default async function PortalReport({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePortalCtx();
  const { id } = await params;
  const r = await db.sharedReport.findFirst({ where: { id, orgId: ctx.orgId, clientId: ctx.clientId } });
  if (!r) notFound();
  const p = r.payload as Payload;
  const cur = ctx.org.currency;
  return (
    <div className="mt-4">
      <PageHeader back={{ href: "/portal", label: "Portal" }} title={r.title} description={`${date(r.periodFrom)} – ${date(r.periodTo)} · shared ${date(r.createdAt)}`} actions={<PrintButton />} />
      <div className="flex flex-col gap-4">
        {p.projects.map((pr) => (
          <Card key={pr.name}><CardHeader title={<span className="flex items-center gap-2">{pr.name} <StatusBadge status={pr.status} /></span>} />
            <CardBody className="text-sm">
              {pr.deliverables.length ? <ul className="divide-y divide-border">{pr.deliverables.map((d, i) => <li key={i} className="flex justify-between gap-2 py-2"><span>{d.title} <span className="text-muted">· {d.type}</span></span><span className="flex items-center gap-2"><span className="num text-muted">{d.completed}/{d.contracted}</span><StatusBadge status={d.status} /></span></li>)}</ul> : <p className="text-muted">No deliverables due in this period.</p>}
              {pr.approvedChanges.length ? <><p className="mt-4 font-medium">Approved additional work</p><ul className="mt-1 text-muted">{pr.approvedChanges.map((c, i) => <li key={i}>{c.ref} {c.title} — {money(c.amount, cur)}</li>)}</ul></> : null}
            </CardBody></Card>
        ))}
        <Card><CardHeader title="Invoices in period" /><CardBody className="text-sm">
          {p.invoices.length ? <ul className="divide-y divide-border">{p.invoices.map((i) => <li key={i.number} className="flex justify-between gap-2 py-2"><span>{i.number} · {date(i.issueDate)}</span><span className="flex items-center gap-2"><span className="num">{money(i.total, cur)}</span><StatusBadge status={i.status} /></span></li>)}</ul> : <p className="text-muted">No invoices in this period.</p>}
        </CardBody></Card>
      </div>
    </div>
  );
}
