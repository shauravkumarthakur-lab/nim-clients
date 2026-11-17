import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { loadOrgData } from "@/lib/finance/load";
import { resolvePeriod } from "@/lib/period";
import { buildReport, toCsv } from "@/lib/reports";

const MAP: Record<string, string> = { clients: "clients", projects: "projects", deliverables: "deliverables", expenses: "expenses-detail", time: "time-detail", invoices: "invoices-detail" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!can(ctx.role, "VIEW_FINANCIALS")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { entity } = await params;
  const key = entity.startsWith("report-") ? entity.slice(7) : MAP[entity];
  if (!key) return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { period } = resolvePeriod(sp, "last_3_months");
  const r = buildReport(key, await loadOrgData(ctx.orgId), period, { overheadMethod: ctx.org.overheadMethod });
  if (!r) return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  const file = `marginos-${key}-${period.from.toISOString().slice(0, 10)}.csv`;
  return new NextResponse(toCsv(r), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${file}"`, "cache-control": "no-store" } });
}
