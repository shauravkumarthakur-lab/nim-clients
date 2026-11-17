import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCtx } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { loadedHourlyCost } from "@/lib/finance/engine";
import { parseCsv, TEMPLATES, validateRows, type ImportEntity } from "@/lib/csv-import";

const PERM = { expenses: "MANAGE_FINANCE", clients: "MANAGE_WORK", time: "MANAGE_WORK" } as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!(entity in TEMPLATES)) return NextResponse.json({ error: "Unknown" }, { status: 404 });
  return new NextResponse(TEMPLATES[entity as ImportEntity], { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="marginos-${entity}-template.csv"` } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { entity } = await params;
  if (!(entity in PERM)) return NextResponse.json({ error: "Unknown import" }, { status: 404 });
  const e = entity as ImportEntity;
  if (!can(ctx.role, PERM[e])) return NextResponse.json({ error: "You don't have permission to import this." }, { status: 403 });
  if (!rateLimit(`import:${ctx.orgId}`, 20, 60 * 60_000).ok) return NextResponse.json({ error: "Too many imports. Try later." }, { status: 429 });
  const { rows, error } = parseCsv(await req.text());
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!rows.length) return NextResponse.json({ error: "The file has no data rows." }, { status: 400 });
  const orgId = ctx.orgId;
  const [categories, vendors, projects, clients, employees] = await Promise.all([
    db.expenseCategory.findMany({ where: { orgId } }), db.vendor.findMany({ where: { orgId } }), db.project.findMany({ where: { orgId } }),
    db.client.findMany({ where: { orgId } }), db.employee.findMany({ where: { orgId, email: { not: null } } }),
  ]);
  const k = (s: string) => s.trim().toLowerCase();
  const { errors, records } = validateRows(e, rows, {
    categories: new Map(categories.map((c) => [k(c.name), c.id])), vendors: new Map(vendors.map((v) => [k(v.name), v.id])),
    projects: new Map(projects.map((p) => [k(p.name), { id: p.id, clientId: p.clientId }])), clients: new Map(clients.map((c) => [k(c.name), c.id])),
    employees: new Map(employees.map((x) => [k(x.email!), { id: x.id, rate: loadedHourlyCost({ id: x.id, monthlySalary: x.monthlySalary, benefitsLoadPct: x.benefitsLoadPct, monthlyHours: x.monthlyHours }).toFixed(2) }])),
  });
  if (errors.length) return NextResponse.json({ errors: errors.slice(0, 50) }, { status: 422 });
  const withOrg = records.map((r) => ({ ...r, orgId }));
  if (e === "expenses") await db.expense.createMany({ data: withOrg as Prisma.ExpenseCreateManyInput[] });
  else if (e === "clients") await db.client.createMany({ data: withOrg as Prisma.ClientCreateManyInput[] });
  else await db.timeEntry.createMany({ data: withOrg as Prisma.TimeEntryCreateManyInput[] });
  await audit(ctx, `import.${e}`, e, null, { rows: records.length });
  return NextResponse.json({ created: records.length });
}
