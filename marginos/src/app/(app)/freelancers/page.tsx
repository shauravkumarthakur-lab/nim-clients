import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { d, sum } from "@/lib/finance/engine";
import { money, date } from "@/lib/format";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmAction, FormDialog } from "@/components/ui/form-dialog";
import { LinkButton } from "@/components/ui/button";
import { freelancerFields } from "@/components/forms";
import { deleteFreelancer, saveFreelancer } from "../team/actions";

export const metadata = { title: "Freelancers" };

export default async function FreelancersPage() {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const cur = ctx.org.currency;
  const fl = await db.freelancer.findMany({ where: { orgId: ctx.orgId }, include: { expenses: { include: { project: { select: { id: true, name: true } } }, orderBy: { date: "desc" } }, assignments: { include: { project: { select: { name: true } } } } }, orderBy: { name: "asc" } });
  const rows = fl.map((f) => ({
    f, total: sum(f.expenses.map((e) => d(e.amount))), unpaid: sum(f.expenses.filter((e) => e.paymentStatus === "UNPAID").map((e) => d(e.amount))),
    projects: [...new Set([...f.expenses.map((e) => e.project?.name).filter(Boolean), ...f.assignments.map((a) => a.project.name)])] as string[],
  }));
  const payments = fl.flatMap((f) => f.expenses.map((e) => ({ ...e, freelancer: f.name }))).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 25);
  const manage = can(ctx.role, "MANAGE_TEAM");
  return (
    <>
      <PageHeader title="Freelancers" description="Rates, assignments and payments. Freelancer payments are recorded as expenses so they're counted once." actions={<>
        <LinkButton href="/expenses?kind=FREELANCER" variant="secondary" size="sm">Record payment</LinkButton>
        {manage ? <FormDialog testId="new-freelancer" title="Add freelancer" triggerLabel="Add freelancer" action={saveFreelancer} fields={freelancerFields} defaults={{ rateType: "HOURLY", active: true }} /> : null}
      </>} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Active freelancers" value={fl.filter((f) => f.active).length} />
        <Stat label="Total spend (all time)" value={money(sum(rows.map((r) => r.total)), cur)} />
        <Stat label="Unpaid" value={money(sum(rows.map((r) => r.unpaid)), cur)} tone="warn" />
      </section>
      <Card className="mt-5">
        <DataTable testId="freelancers-table" rows={rows} rowKey={(r) => r.f.id} columns={[
          { key: "n", header: "Name", primary: true, cell: (r) => <span>{r.f.name}{!r.f.active ? <Badge className="ml-1">Inactive</Badge> : null}</span> },
          { key: "s", header: "Skill", cell: (r) => r.f.skill },
          { key: "r", header: "Rate", align: "right", cell: (r) => `${money(r.f.rate, cur)} ${r.f.rateType === "HOURLY" ? "/ h" : "fixed"}` },
          { key: "p", header: "Projects", cell: (r) => <span className="line-clamp-2 text-[12px]">{r.projects.join(", ") || "—"}</span> },
          { key: "t", header: "Total paid", align: "right", highlight: true, cell: (r) => money(r.total, cur) },
          { key: "u", header: "Unpaid", align: "right", cell: (r) => <span className={r.unpaid.gt(0) ? "text-warn" : ""}>{money(r.unpaid, cur)}</span> },
          { key: "actions", header: "", cell: (r) => manage ? <div className="flex justify-end">
            <FormDialog mode="edit" title="Edit freelancer" action={saveFreelancer} fields={[{ name: "id", label: "id", type: "hidden" }, ...freelancerFields]} defaults={{ id: r.f.id, name: r.f.name, skill: r.f.skill, email: r.f.email, phone: r.f.phone, rateType: r.f.rateType, rate: r.f.rate.toString(), active: r.f.active }} />
            <ConfirmAction action={deleteFreelancer} payload={{ id: r.f.id }} label="Delete" title="Delete freelancer?" description="Only possible when no payments are recorded." />
          </div> : null },
        ]} />
      </Card>
      <Card className="mt-5">
        <CardHeader title="Recent freelancer payments" />
        <DataTable rows={payments} rowKey={(p) => p.id} columns={[
          { key: "d", header: "Description", primary: true, cell: (p) => p.description },
          { key: "f", header: "Freelancer", cell: (p) => p.freelancer },
          { key: "p", header: "Project", cell: (p) => p.project?.name ?? "Overhead" },
          { key: "dt", header: "Date", cell: (p) => date(p.date) },
          { key: "st", header: "Status", cell: (p) => <Badge tone={p.paymentStatus === "PAID" ? "gain" : "warn"}>{p.paymentStatus.toLowerCase()}</Badge> },
          { key: "a", header: "Amount", align: "right", highlight: true, cell: (p) => money(p.amount, cur) },
        ]} />
      </Card>
    </>
  );
}
