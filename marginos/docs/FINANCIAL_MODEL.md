# Financial model

All formulas live in `src/lib/finance/engine.ts` (pure functions, `decimal.js`) and are covered by `engine.test.ts`. The in-app page **Reports → Methodology** shows the same definitions.

| Metric | Definition |
|---|---|
| Revenue (recognised) | Σ invoice fee (ex-tax) for invoices *issued* in the period, excluding Draft and Void. Credit notes are negative invoices. Tax and pass-through media spend are never revenue. |
| Cash collected | Σ payments dated in the period (refunds are negative payments). Reported separately from revenue. |
| Receivable / balance | Invoice total (fee + tax + pass-through) − payments, never below 0. Overdue = past due date. Status (Sent / Partially paid / Paid) is derived from payments. |
| Loaded monthly cost | salary × (1 + employer load %) |
| Loaded hourly cost | loaded monthly cost ÷ contracted monthly hours, snapshotted on each time entry |
| Payroll (period) | Σ loaded monthly cost × fraction of each calendar month employed in the period (joined/left dates respected) |
| Direct labour | Σ time-entry hours × snapshot rate |
| Direct external cost | Expenses linked to a client or project |
| Gross profit | Revenue − direct external cost |
| **Contribution profit** | **Revenue − direct costs** (labour + external) |
| **Contribution margin %** | **Contribution ÷ revenue × 100**; shown as "—" when revenue ≤ 0 |
| Overhead | (Payroll − direct labour) + expenses not linked to any client/project |
| Net profit | Contribution − overhead ≡ revenue − payroll − all expenses |

## No double counting

Salaries enter the P&L once, as payroll. Hours logged to projects move that part of payroll from overhead into direct cost:

```
Net = Revenue − DirectLabour − DirectExternal − (Payroll − DirectLabour) − Indirect
    = Revenue − Payroll − AllExpenses
```

Freelancer payments are expenses (kind FREELANCER), so they are counted once. Payment status (paid/unpaid) is cash information and does not change cost.

## Overhead allocation

For client net profit, total overhead (if positive) is allocated across clients by:

- **Revenue share** (default): client revenue ÷ total revenue, or
- **Labour hours**: client logged hours ÷ total logged hours (Settings → Organisation).

Clients with zero or negative weight get none. The largest-remainder method guarantees the allocations sum *exactly* to total overhead, so client net profits reconcile to company net profit. A unit test checks this for both methods.

## Projects

- Budget used % = actual cost ÷ cost budget (Warning ≥ 90%, Over > 100%); hours used % likewise.
- Profit (invoiced) = invoiced revenue − actual cost to date.
- Projected margin = (contract value + approved change requests − actual cost) ÷ (contract value + approved changes).

## Deliverables & production economics

- Deliverable cost = time logged to it + expenses linked to it. Production hours = planning/shoot/production/design; editing hours = editing/revision.
- Units = quantity completed (or contracted if none completed). Cost/revenue/profit per unit = totals ÷ units.
- By type: unit-weighted averages.
- Cost of one shoot day = (shoot labour + equipment/travel/production expenses on deliverables with shoot days) ÷ total shoot days.

## Utilisation

Utilisation = billable hours ÷ capacity hours (capacity prorated like payroll). Underutilised < 60%; overloaded when total logged > capacity.

## Scope creep

Cost = out-of-scope time cost + out-of-scope expenses. Recovered = quoted amounts of Approved or Invoiced change requests. Unrecovered = max(0, cost − recovered).

Alerts fire for: revision count > limit; logged "additional deliverable" or "outside contract / scope change / unplanned" requests not yet quoted; hours > budget; cost > budget (warning at 90%); projected margin below target.

## Scenarios (estimates)

`applyScenario` scales direct external, labour or price linearly and reports the change in margin and net profit. `priceForTargetMargin` = direct costs ÷ (1 − target). Both are always labelled **Estimate** in the UI and advisor.

## Rounding

Each line is rounded half-up to 2 dp, and totals are sums of rounded lines, so every on-screen total reconciles with its rows. Margins are rounded to 1 dp.
