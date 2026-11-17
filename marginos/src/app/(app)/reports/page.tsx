import Link from "next/link";
import { ArrowRight, FileSpreadsheet } from "lucide-react";
import { requireCtx } from "@/lib/tenant";
import { REPORTS } from "@/lib/reports";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireCtx("VIEW_FINANCIALS");
  return (
    <>
      <PageHeader title="Reports" description="Every report is calculated live from your records. View on screen, print to PDF, or download CSV." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="report-list">
        {REPORTS.map((r) => (
          <Link key={r.key} href={`/reports/${r.key}`} className="card group flex flex-col p-5 hover:border-border-strong">
            <FileSpreadsheet size={20} className="text-brand" />
            <p className="mt-3 font-medium">{r.title}</p>
            <p className="mt-1 flex-1 text-[13px] text-muted">{r.description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium">Open <ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></span>
          </Link>
        ))}
        <Link href="/reports/methodology" className="card flex flex-col p-5 hover:border-border-strong">
          <p className="font-medium">Methodology</p><p className="mt-1 text-[13px] text-muted">How every number in MarginOS is calculated, including overhead allocation.</p>
        </Link>
      </div>
    </>
  );
}
