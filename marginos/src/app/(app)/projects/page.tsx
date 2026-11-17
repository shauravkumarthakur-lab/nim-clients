import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { loadOrgData } from "@/lib/finance/load";
import { projectRows } from "@/lib/finance/analytics";
import { options } from "@/lib/options";
import { money, pct, hours } from "@/lib/format";
import { PageHeader, Signed, EmptyState, Bar, Tabs } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { LinkButton } from "@/components/ui/button";
import { SearchBox } from "@/components/search-box";
import { projectFields } from "@/components/forms";
import { saveProject } from "./actions";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const sp = await searchParams;
  const data = await loadOrgData(ctx.orgId);
  const opts = await options(ctx.orgId);
  const cur = ctx.org.currency;
  const status = sp.status ?? "all";
  const search = (sp.q ?? "").toLowerCase();
  const all = projectRows(data);
  const rows = all
    .filter((r) => status === "all" || (status === "over" ? r.pp.budgetState === "OVER" : r.project.status === status))
    .filter((r) => !search || r.project.name.toLowerCase().includes(search) || r.clientName.toLowerCase().includes(search));
  const count = (s: string) => all.filter((r) => (s === "over" ? r.pp.budgetState === "OVER" : r.project.status === s)).length;
  return (
    <>
      <PageHeader title="Projects" description="Budget vs actual and margin for every project (lifetime)" actions={<>
        <LinkButton href="/api/export/projects" variant="secondary" size="sm" prefetch={false}>Export CSV</LinkButton>
        {can(ctx.role, "MANAGE_WORK") ? <FormDialog testId="new-project" title="New project" triggerLabel="New project" action={saveProject} fields={projectFields(opts.clients, opts.employees)} defaults={{ status: "ACTIVE", revisionLimit: "2", contractValue: "0", budget: "0", clientId: sp.client }} wide /> : null}
      </>} />
      <Tabs active={status} items={[
        { key: "all", href: "/projects", label: `All (${all.length})` },
        { key: "ACTIVE", href: "/projects?status=ACTIVE", label: `Active (${count("ACTIVE")})` },
        { key: "over", href: "/projects?status=over", label: `Over budget (${count("over")})` },
        { key: "PLANNING", href: "/projects?status=PLANNING", label: `Planning (${count("PLANNING")})` },
        { key: "COMPLETED", href: "/projects?status=COMPLETED", label: `Completed (${count("COMPLETED")})` },
      ]} />
      <div className="mb-4"><SearchBox placeholder="Search projects or clients" /></div>
      <Card>
        <DataTable testId="projects-table" rows={rows} rowKey={(r) => r.project.id} rowHref={(r) => `/projects/${r.project.id}`}
          empty={<div className="p-4"><EmptyState title="No projects match" description="Create a project to start tracking budget versus actual." /></div>}
          columns={[
            { key: "n", header: "Project", primary: true, cell: (r) => r.project.name },
            { key: "c", header: "Client", cell: (r) => r.clientName },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.project.status} /> },
            { key: "cv", header: "Contract", align: "right", cell: (r) => money(r.project.contractValue, cur) },
            { key: "cost", header: "Actual cost", align: "right", cell: (r) => money(r.pp.totalCost, cur) },
            { key: "bud", header: "Budget used", cell: (r) => r.pp.budgetUsedPct ? <div className="w-28"><div className="mb-1 flex justify-between text-[11px]"><span className="num">{pct(r.pp.budgetUsedPct, 0)}</span>{r.pp.budgetState === "OVER" ? <Badge tone="loss">Over</Badge> : null}</div><Bar value={r.pp.budgetUsedPct.toNumber()} tone={r.pp.budgetState === "OVER" ? "loss" : r.pp.budgetState === "WARNING" ? "warn" : "brand"} /></div> : <span className="text-subtle">No budget</span> },
            { key: "h", header: "Hours", align: "right", hideOnMobile: true, cell: (r) => `${hours(r.pp.hours)}${r.project.budgetHours.gt(0) ? ` / ${r.project.budgetHours.toFixed(0)}` : ""}` },
            { key: "p", header: "Profit (invoiced)", align: "right", cell: (r) => <Signed value={r.pp.profit.toNumber()}>{money(r.pp.profit, cur)}</Signed> },
            { key: "pm", header: "Projected margin", align: "right", highlight: true, cell: (r) => <Signed value={r.pp.projectedMarginPct?.toNumber()}>{pct(r.pp.projectedMarginPct)}</Signed> },
          ]} />
      </Card>
      <p className="mt-3 text-[12px] text-subtle">Profit (invoiced) = invoiced revenue − actual cost to date. Projected margin = (contract value + approved changes − actual cost) ÷ (contract value + approved changes).</p>
    </>
  );
}
