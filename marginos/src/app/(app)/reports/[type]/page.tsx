import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/tenant";
import { resolvePeriod, periodQuery } from "@/lib/period";
import { loadOrgData } from "@/lib/finance/load";
import { buildReport, REPORTS, type Cell, type ColType } from "@/lib/reports";
import { date, money, pct, hours, int } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { PeriodFilter } from "@/components/period-filter";
import { PrintButton } from "@/components/print-button";
import { cn } from "@/components/ui/cn";

function fmt(v: Cell, t: ColType, cur: string) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string" && t !== "date") return v;
  switch (t) { case "money": return money(v, cur); case "pct": return pct(v); case "hours": return hours(v); case "int": return int(v); case "date": return date(String(v)); default: return String(v); }
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx("VIEW_FINANCIALS");
  const { type } = await params;
  const meta = REPORTS.find((r) => r.key === type);
  if (!meta) notFound();
  const { key, period, label } = resolvePeriod(await searchParams, "last_3_months");
  const data = await loadOrgData(ctx.orgId);
  const r = buildReport(type, data, period, { overheadMethod: ctx.org.overheadMethod })!;
  const cur = ctx.org.currency;
  const q = periodQuery(key, period);
  return (
    <>
      <PageHeader back={{ href: "/reports", label: "Reports" }} title={r.title} description={`${ctx.org.name} · ${meta.periodic ? label : "All time / as of today"} · generated ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
        actions={<>{meta.periodic ? <PeriodFilter value={key} /> : null}<PrintButton /><LinkButton href={`/api/export/report-${type}?${q}`} variant="secondary" size="sm" prefetch={false}>Download CSV</LinkButton></>} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" data-testid="report-table">
            <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-subtle">
              {r.columns.map((c) => <th key={c.header} className={cn("whitespace-nowrap px-3 py-2.5 font-medium", c.type !== "text" && "text-right")}>{c.header}</th>)}
            </tr></thead>
            <tbody>
              {r.rows.length ? r.rows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {row.map((v, j) => <td key={j} className={cn("px-3 py-2", r.columns[j].type !== "text" && "num whitespace-nowrap text-right", typeof v === "number" && v < 0 && r.columns[j].type !== "int" && "text-loss")}>{fmt(v, r.columns[j].type, cur)}</td>)}
                </tr>
              )) : <tr><td className="px-3 py-8 text-center text-muted" colSpan={r.columns.length}>No data for this period.</td></tr>}
            </tbody>
            {r.totals && r.rows.length ? <tfoot><tr className="border-t border-border-strong font-semibold">{r.totals.map((v, j) => <td key={j} className={cn("px-3 py-2.5", r.columns[j].type !== "text" && "num whitespace-nowrap text-right")}>{v === null ? "" : fmt(v, r.columns[j].type, cur)}</td>)}</tr></tfoot> : null}
          </table>
        </div>
      </Card>
      {r.notes?.length ? <ul className="mt-3 list-disc pl-5 text-[12px] text-subtle">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
      <p className="mt-3 text-[11px] text-subtle">Management report. MarginOS is not an accounting or tax-compliance system.</p>
    </>
  );
}
