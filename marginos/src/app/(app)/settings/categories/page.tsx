import { requireCtx } from "@/lib/tenant";
import { db } from "@/lib/db";
import { EXPENSE_KINDS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmAction, FormDialog, type FieldDef } from "@/components/ui/form-dialog";
import { SettingsTabs } from "../tabs";
import { deleteCategory, deleteVendor, saveCategory, saveVendor } from "../actions";

export const metadata = { title: "Categories & vendors" };
const catFields: FieldDef[] = [{ name: "id", label: "id", type: "hidden" }, { name: "name", label: "Name", required: true }, { name: "kind", label: "Cost type", type: "select", required: true, options: EXPENSE_KINDS, hint: "Drives how the cost appears in project and production economics." }];
const vendorFields: FieldDef[] = [{ name: "id", label: "id", type: "hidden" }, { name: "name", label: "Name", required: true }, { name: "category", label: "Category" }, { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone", type: "tel" }];

export default async function CategoriesPage() {
  const ctx = await requireCtx("MANAGE_ORG");
  const [cats, vendors] = await Promise.all([
    db.expenseCategory.findMany({ where: { orgId: ctx.orgId }, include: { _count: { select: { expenses: true } } }, orderBy: { name: "asc" } }),
    db.vendor.findMany({ where: { orgId: ctx.orgId }, include: { _count: { select: { expenses: true } } }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Settings" description="Expense categories & vendors" />
      <SettingsTabs active="categories" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Expense categories" action={<FormDialog title="New category" triggerLabel="Add" action={saveCategory} fields={catFields} defaults={{ kind: "OTHER" }} testId="new-category" />} />
          <DataTable rows={cats} rowKey={(c) => c.id} columns={[
            { key: "n", header: "Name", primary: true, cell: (c) => c.name },
            { key: "k", header: "Type", cell: (c) => EXPENSE_KINDS.find((k) => k.value === c.kind)?.label },
            { key: "u", header: "Expenses", align: "right", highlight: true, cell: (c) => c._count.expenses },
            { key: "actions", header: "", cell: (c) => <div className="flex justify-end"><FormDialog mode="edit" title="Edit category" action={saveCategory} fields={catFields} defaults={{ id: c.id, name: c.name, kind: c.kind }} /><ConfirmAction action={deleteCategory} payload={{ id: c.id }} label="Delete" title="Delete category?" description="Only unused categories can be deleted." /></div> },
          ]} />
        </Card>
        <Card>
          <CardHeader title="Vendors" action={<FormDialog title="New vendor" triggerLabel="Add" action={saveVendor} fields={vendorFields} testId="new-vendor" />} />
          <DataTable rows={vendors} rowKey={(v) => v.id} columns={[
            { key: "n", header: "Name", primary: true, cell: (v) => v.name },
            { key: "c", header: "Category", cell: (v) => v.category ?? "—" },
            { key: "u", header: "Expenses", align: "right", highlight: true, cell: (v) => v._count.expenses },
            { key: "actions", header: "", cell: (v) => <div className="flex justify-end"><FormDialog mode="edit" title="Edit vendor" action={saveVendor} fields={vendorFields} defaults={{ id: v.id, name: v.name, category: v.category, email: v.email, phone: v.phone }} /><ConfirmAction action={deleteVendor} payload={{ id: v.id }} label="Delete" title="Delete vendor?" description="Expenses keep their amounts; the vendor link is cleared." /></div> },
          ]} />
        </Card>
      </div>
    </>
  );
}
