import { requireCtx } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";

export const metadata = { title: "Methodology" };

const ITEMS: [string, string][] = [
  ["Revenue", "Sum of invoice fees (ex-tax) for invoices issued in the period, excluding drafts and voided invoices. Credit notes are negative invoices. Tax and pass-through media spend are never revenue."],
  ["Cash collected", "Sum of payments dated in the period, including tax. Refunds are negative payments. Kept separate from revenue."],
  ["Outstanding receivables", "For each sent invoice: total (fee + tax + pass-through) minus payments, never below zero. Overdue = past due date."],
  ["Loaded cost per hour", "Monthly salary × (1 + employer load %) ÷ contracted monthly hours. Snapshotted onto each time entry when it's logged, so later salary changes don't rewrite past costs."],
  ["Direct labour", "Σ hours × snapshot cost rate for time logged in the period."],
  ["Direct external costs", "Expenses linked to a client or project (freelancers, production, equipment, travel…). A project's client is resolved server-side so a cost can only belong to one client."],
  ["Gross profit", "Revenue − direct external costs."],
  ["Contribution profit", "Revenue − direct costs (direct labour + direct external). Contribution margin = contribution ÷ revenue × 100; shown as “—” when revenue is zero or negative."],
  ["Payroll", "Loaded monthly cost of every employee, prorated by calendar days employed in the period (joined/left dates respected). Never projected beyond today."],
  ["Overhead", "Unallocated payroll (payroll − direct labour) + expenses not linked to any client/project."],
  ["Net profit", "Contribution − overhead. This is algebraically identical to revenue − payroll − all expenses, so no cost is ever counted twice: logged labour moves from overhead to direct cost."],
  ["Overhead allocation", "For client net profit, overhead is split across clients by share of revenue (default) or by share of logged labour hours (Settings). Clients with no revenue/hours get none. Allocations use the largest-remainder method so they sum exactly to total overhead."],
  ["Project budget", "Budget used % = actual cost ÷ cost budget. Warning at 90%, over at 100%. Hours used % = logged ÷ budgeted hours."],
  ["Projected margin", "(Contract value + approved change requests − actual cost to date) ÷ (contract value + approved changes)."],
  ["Cost per deliverable", "Total cost (time + linked expenses) ÷ units; units = quantity completed, or contracted if none completed yet."],
  ["Cost of one shoot day", "(Shoot-type labour + equipment, travel and production expenses on deliverables with shoot days) ÷ total shoot days."],
  ["Utilisation", "Billable hours ÷ capacity hours. Underutilised below 60%; overloaded when total logged hours exceed capacity."],
  ["Scope creep cost", "Out-of-scope time (hours × rate) + out-of-scope expenses. Recovered = approved/invoiced change requests. Unrecovered = max(0, cost − recovered)."],
  ["Precision", "All money arithmetic uses decimal (not floating-point) maths, rounded half-up to 2 decimals per line; totals are sums of rounded lines."],
];

export default async function MethodologyPage() {
  await requireCtx("VIEW_FINANCIALS");
  return (
    <>
      <PageHeader back={{ href: "/reports", label: "Reports" }} title="Methodology" description="Deterministic formulas used by the MarginOS calculation engine (src/lib/finance/engine.ts)." />
      <Card className="max-w-3xl"><CardBody>
        <dl className="flex flex-col divide-y divide-border">
          {ITEMS.map(([k, v]) => <div key={k} className="grid gap-1 py-3 sm:grid-cols-[200px_1fr]"><dt className="text-[13px] font-medium">{k}</dt><dd className="text-[13px] text-muted">{v}</dd></div>)}
        </dl>
      </CardBody></Card>
    </>
  );
}
