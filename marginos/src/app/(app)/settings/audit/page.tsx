import { requireCtx } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { SettingsTabs } from "../tabs";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const ctx = await requireCtx("VIEW_AUDIT");
  const logs = await db.auditLog.findMany({ where: { orgId: ctx.orgId }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Settings" description="Audit log — sensitive changes (last 200)" />
      <SettingsTabs active="audit" />
      <Card>
        <DataTable testId="audit-table" rows={logs} rowKey={(l) => l.id} empty={<p className="p-6 text-sm text-muted">No audited changes yet.</p>} columns={[
          { key: "a", header: "Action", primary: true, cell: (l) => <code className="text-[12px]">{l.action}</code> },
          { key: "t", header: "When", highlight: true, cell: (l) => l.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) },
          { key: "u", header: "By", cell: (l) => l.user?.name ?? "—" },
          { key: "e", header: "Record", cell: (l) => l.entityType },
          { key: "d", header: "Details", cell: (l) => <span className="line-clamp-2 max-w-md break-all text-[12px] text-muted">{l.details ? JSON.stringify(l.details) : ""}</span> },
        ]} />
      </Card>
    </>
  );
}
