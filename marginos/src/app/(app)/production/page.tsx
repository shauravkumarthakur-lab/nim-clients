import { requireCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { loadOrgData } from "@/lib/finance/load";
import { productionEconomics } from "@/lib/finance/analytics";
import { DELIVERABLE_TYPES, deliverableLabel } from "@/lib/constants";
import { money, pct, hours } from "@/lib/format";
import { PageHeader, Stat, Signed } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { FilterSelect } from "@/components/filter-select";
import { LinkButton } from "@/components/ui/button";
import { enumOptions } from "@/lib/options";
import { updateDeliverableProgress } from "../projects/actions";

export const metadata = { title: "Production economics" };

export default async function ProductionPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx("VIEW_WORK");
  const sp = await searchParams;
  const data = await loadOrgData(ctx.orgId);
  const cur = ctx.org.currency;
  const m = (v: Parameters<typeof money>[0]) => money(v, cur);
  const fin = can(ctx.role, "VIEW_FINANCIALS");
  const pe = productionEconomics(data);
  const rows = pe.rows.filter((r) => (!sp.type || r.deliverable.type === sp.type) && (!sp.status || r.deliverable.status === sp.status))
    .sort((a, b) => (b.deliverable.dueDate?.getTime() ?? 0) - (a.deliverable.dueDate?.getTime() ?? 0));
  const PAGE = 40;
  const page = Math.max(1, Number(sp.page) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const pageHref = (n: number) => `/production?${new URLSearchParams({ ...(sp.type ? { type: sp.type } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(n) })}`;
  const t = (type: string) => pe.byType.find((x) => x.type === type);
  const progressFields = [
    { name: "id", label: "id", type: "hidden" as const },
    { name: "status", label: "Status", type: "select" as const, required: true, options: enumOptions(["NOT_STARTED", "IN_PROGRESS", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "DELIVERED"]) },
    { name: "quantityCompleted", label: "Quantity completed", type: "number" as const, required: true },
    { name: "revisionCount", label: "Revisions so far", type: "number" as const, required: true },
    { name: "sharedWithClient", label: "Visible in client portal for review", type: "checkbox" as const, full: true },
  ];
  return (
    <>
      <PageHeader title={fin ? "Creative production economics" : "Deliverables"} description={fin ? "What each reel, video, design and shoot day actually costs you — team time at loaded cost plus freelancers, equipment and travel." : "Track and update progress on deliverables."}
        actions={fin ? <LinkButton href="/api/export/deliverables" variant="secondary" size="sm" prefetch={false}>Export CSV</LinkButton> : null} />
      {fin ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="unit-costs">
            <Stat label="Cost of one reel" value={m(t("REEL")?.avgCostPerUnit)} sub={t("REEL") ? `${hours(t("REEL")!.avgHoursPerUnit)} avg · ${t("REEL")!.units} reels` : "No reels yet"} />
            <Stat label="Cost of one long-form video" value={m(t("LONG_VIDEO")?.avgCostPerUnit)} sub={t("LONG_VIDEO") ? `${t("LONG_VIDEO")!.units} videos` : "None yet"} />
            <Stat label="Cost of one graphic" value={m(t("GRAPHIC_DESIGN")?.avgCostPerUnit)} sub={t("GRAPHIC_DESIGN") ? `${t("GRAPHIC_DESIGN")!.units} designs` : "None yet"} />
            <Stat label="Cost of one shoot day" value={m(pe.shootDay.perDay)} sub={`${pe.shootDay.days.toString()} shoot days · crew time + kit + travel`} />
          </section>
          <Card className="mt-5">
            <CardHeader title="Unit economics by deliverable type" description="Unit-weighted averages across all projects (completed units, else contracted)" />
            <DataTable testId="type-economics" rows={pe.byType} rowKey={(r) => r.type} columns={[
              { key: "t", header: "Type", primary: true, cell: (r) => deliverableLabel(r.type) },
              { key: "u", header: "Units", align: "right", cell: (r) => r.units },
              { key: "h", header: "Hours / unit", align: "right", cell: (r) => hours(r.avgHoursPerUnit) },
              { key: "rv", header: "Avg revisions", align: "right", cell: (r) => r.avgRevisions?.toString() ?? "—" },
              { key: "c", header: "Cost / unit", align: "right", highlight: true, cell: (r) => m(r.avgCostPerUnit) },
              { key: "r", header: "Revenue / unit", align: "right", cell: (r) => m(r.avgRevenuePerUnit) },
              { key: "p", header: "Profit / unit", align: "right", cell: (r) => <Signed value={r.avgProfitPerUnit?.toNumber()}>{m(r.avgProfitPerUnit)}</Signed> },
              { key: "m", header: "Margin", align: "right", cell: (r) => <Badge tone={!r.marginPct ? "neutral" : r.marginPct.lt(0) ? "loss" : r.marginPct.lt(30) ? "warn" : "gain"}>{pct(r.marginPct)}</Badge> },
            ]} />
          </Card>
        </>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <FilterSelect param="type" label="All types" options={[...DELIVERABLE_TYPES]} />
        <FilterSelect param="status" label="All statuses" options={enumOptions(["NOT_STARTED", "IN_PROGRESS", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "DELIVERED"])} />
      </div>
      <Card className="mt-4">
        <CardHeader title="Deliverables" description={`${rows.length} deliverables`} />
        <DataTable testId="production-table" rows={shown} rowKey={(r) => r.deliverable.id} rowHref={fin ? (r) => `/projects/${r.project.id}#deliverables` : undefined} columns={[
          { key: "t", header: "Deliverable", primary: true, cell: (r) => <span>{r.deliverable.title}{r.deliverable.outOfScope ? <Badge tone="loss" className="ml-1">Out of scope</Badge> : null}</span> },
          { key: "p", header: "Project", cell: (r) => r.project.name },
          { key: "ty", header: "Type", cell: (r) => deliverableLabel(r.deliverable.type) },
          { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.deliverable.status} /> },
          { key: "q", header: "Done", align: "right", cell: (r) => `${r.deliverable.quantityCompleted}/${r.deliverable.quantityContracted}` },
          { key: "ph", header: "Prod. h", align: "right", hideOnMobile: true, cell: (r) => hours(r.econ.productionHours) },
          { key: "eh", header: "Edit h", align: "right", hideOnMobile: true, cell: (r) => hours(r.econ.editingHours) },
          { key: "rv", header: "Revisions", align: "right", cell: (r) => <span className={r.econ.revisionsOverLimit ? "text-loss" : ""}>{r.deliverable.revisionCount}</span> },
          ...(fin ? [
            { key: "c", header: "Total cost", align: "right" as const, cell: (r: (typeof rows)[number]) => m(r.econ.totalCost) },
            { key: "cu", header: "Cost / unit", align: "right" as const, highlight: true, cell: (r: (typeof rows)[number]) => m(r.econ.costPerUnit) },
            { key: "pu", header: "Profit / unit", align: "right" as const, cell: (r: (typeof rows)[number]) => <Signed value={r.econ.profitPerUnit?.toNumber()}>{m(r.econ.profitPerUnit)}</Signed> },
          ] : []),
          { key: "actions", header: "", cell: (r) => can(ctx.role, "LOG_TIME") ? <div className="flex justify-end"><FormDialog mode="edit" title="Update progress" action={updateDeliverableProgress} fields={progressFields}
            defaults={{ id: r.deliverable.id, status: r.deliverable.status, quantityCompleted: String(r.deliverable.quantityCompleted), revisionCount: String(r.deliverable.revisionCount), sharedWithClient: r.deliverable.sharedWithClient }} /></div> : null },
        ]} />
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[13px]">
            <span className="text-muted">Page {page} of {pages}</span>
            <span className="flex gap-2">
              {page > 1 ? <LinkButton href={pageHref(page - 1)} variant="secondary" size="sm">Previous</LinkButton> : null}
              {page < pages ? <LinkButton href={pageHref(page + 1)} variant="secondary" size="sm">Next</LinkButton> : null}
            </span>
          </div>
        ) : null}
      </Card>
    </>
  );
}
