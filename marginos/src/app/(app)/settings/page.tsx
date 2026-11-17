import { requireCtx } from "@/lib/tenant";
import { db } from "@/lib/db";
import { CURRENCIES, BILLING_MODELS, INDUSTRIES } from "@/lib/constants";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormDialog } from "@/components/ui/form-dialog";
import { SettingsTabs } from "./tabs";
import { updateOrg } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireCtx("MANAGE_ORG");
  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  const rows: [string, string][] = [
    ["Agency name", org.name], ["Industry", org.industry ?? "—"], ["Currency", org.currency], ["Billing model", org.billingModel ?? "—"],
    ["Target contribution margin", `${org.targetMarginPct}%`], ["Utilisation target", `${org.utilisationTarget}%`],
    ["Overhead allocation", org.overheadMethod === "REVENUE_SHARE" ? "By share of revenue" : "By share of labour hours"],
  ];
  return (
    <>
      <PageHeader title="Settings" description={org.name} />
      <SettingsTabs active="general" />
      <Card className="max-w-2xl">
        <CardHeader title="Organisation" description="These settings drive margin targets, alerts and overhead allocation."
          action={<FormDialog mode="edit" title="Edit organisation" action={updateOrg} testId="edit-org" fields={[
            { name: "name", label: "Agency name", required: true, full: true },
            { name: "industry", label: "Industry", type: "select", options: INDUSTRIES.map((i) => ({ value: i, label: i })) },
            { name: "currency", label: "Currency", type: "select", required: true, options: CURRENCIES.map((c) => ({ value: c.value, label: c.label })) },
            { name: "billingModel", label: "Billing model", type: "select", options: BILLING_MODELS.map((i) => ({ value: i, label: i })) },
            { name: "targetMarginPct", label: "Target contribution margin %", type: "number", required: true },
            { name: "utilisationTarget", label: "Utilisation target %", type: "number", required: true },
            { name: "overheadMethod", label: "Overhead allocation", type: "select", required: true, options: [{ value: "REVENUE_SHARE", label: "By share of revenue" }, { value: "LABOUR_HOURS", label: "By share of labour hours" }], hint: "How unallocated payroll and indirect expenses are spread across clients for net profit." },
          ]} defaults={{ name: org.name, industry: org.industry, currency: org.currency, billingModel: org.billingModel, targetMarginPct: org.targetMarginPct.toString(), utilisationTarget: org.utilisationTarget.toString(), overheadMethod: org.overheadMethod }} />} />
        <CardBody>
          <dl className="grid grid-cols-1 gap-y-2 text-[13px] sm:grid-cols-[220px_1fr]">
            {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-subtle">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
          <p className="mt-4 text-[12px] text-subtle">Changing currency relabels amounts; it does not convert existing figures.</p>
        </CardBody>
      </Card>
    </>
  );
}
