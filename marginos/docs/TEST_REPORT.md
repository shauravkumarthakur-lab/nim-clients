# Test execution report

**Date:** 2026-11-17 · **Environment:** Linux container, Node 22.23, PostgreSQL 16.15, Chromium (Playwright 1.63), production build (`next build && next start`) against an isolated `marginos_test` database.

## Summary

| Suite | Tool | Result |
|---|---|---|
| Unit: financial engine, RBAC, CSV import/export, rate limiter, periods, demo advisor | Vitest | **46 / 46 passed** |
| End-to-end: desktop (1366×900) | Playwright | **17 / 17 passed** |
| End-to-end: Android (Pixel 7 emulation, touch) | Playwright | **2 / 2 passed** |
| TypeScript (`tsc --noEmit`, strict) | tsc | no errors |
| Lint | ESLint (next/core-web-vitals + TS) | no errors or warnings |
| Production build | `next build` | success (42 routes) |

Commands: `npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Coverage by requirement

| Area | Tested by | What is asserted |
|---|---|---|
| Financial calculations | `engine.test.ts` (28 tests) | Decimal precision (`0.1+0.2`, `1.005`), zero revenue → null margin, missing/NaN → 0, negative values, refunds, partial and over-payments, credit notes, drafts and voids excluded, half-open periods, payroll proration (joined/left mid-month), P&L line by line, **net = revenue − payroll − expenses (no double counting)**, overhead allocation sums exactly (both methods), client P&L reconciles to company P&L, project budget states and alerts, cost per deliverable/type/shoot day, utilisation classes, scope-creep recovery, scenarios. |
| Full user journey | `journey.spec.ts` | Register → onboarding → create and edit client → project → 2 deliverables → assign employee → log 20 h → expense → invoice → partial payment (balance ₹19,500.00) → project profitability with **hand-computed figures** (cost ₹14,200, profit ₹10,800, projected margin 71.6%) → alerts (revision limit, 142% of budget, hours over budget) → scope change logged → quoted (CR-0001) → approved → draft invoice → dashboard reflects records → project report → CSV download contents. |
| Authentication | `auth.spec.ts` | Signup validation, duplicate email, wrong password, session persists across refresh and new tab, logout, forgot → email → reset (single-use, old sessions revoked), no account enumeration, unauthenticated page redirect and API 401, DB health. |
| Multi-tenant isolation | `isolation.spec.ts` | Agency B gets **404** on agency A's client URL; lists and CSV exports exclude A's data; **tampered form** referencing A's client id is rejected server-side and nothing is created; tampered edit targeting A's record changes nothing; demo data never visible in real workspaces. |
| Permissions | `permissions.spec.ts` | Invitation flow; Member lands on Time, has no financial nav, gets **/forbidden** on 6 financial/admin pages and **403** on export API; audit log records acceptance; portal user sees only their client's shared data and no cost/margin information, and can't reach the agency app or exports. |
| Demo, filters, drill-down, advisor, portal | `demo.spec.ts` | Populated dashboard and charts, period filter, drill-down to client, margin-destroyer filter, production unit costs, reports; advisor in demo mode answers with Actual/Estimate labels and record links; portal approval of CR-0004 persists to DB; demo reset regenerates 100+ deliverables and leaves real orgs untouched. |
| Invalid input, API errors, CSV import | `validation.spec.ts` | Zero and 3-decimal amounts rejected; invoice due-before-issue rejected; CSV with a bad row → 422 and nothing imported; valid CSV (incl. a refund) → imported and visible; unknown export/import → 404; empty CSV → 400; unknown record → 404. |
| Mobile (Android) | `mobile.spec.ts` | **No horizontal overflow on 13 app pages** plus landing/login/signup; bottom navigation; "More" sheet; logging time in a bottom-sheet form by touch. |
| PWA | `pwa.spec.ts` | Manifest fields and every icon served; SW served with no-cache; **Chrome `Page.getInstallabilityErrors` = []** and SW registered; offline fallback page shown when offline; security headers present. |

## Defects found and fixed during testing

1. **PWA not installable in production (real bug).** Next 15 streamed `<link rel="manifest">` into `<body>` for non-bot browsers, so Chrome found no manifest. Fixed by `htmlLimitedBots: /.*/`; the installability test now passes.
2. Server actions failed to compile when zod `.refine` callbacks were inline in exported action definitions. Fixed by hoisting schemas to module constants.
3. `useEffect` returned a Promise (`scrollIntoView` returns one in recent Chromium), triggering a React error. Fixed.
4. CSV exports wrote whole-rupee amounts without decimals (`14200` vs `14200.00`). Money columns now always export with 2 dp.
5. Demo data tuning: an account director logged no time (not staffed on teams), 39 noisy alerts, and payroll was charged for future days in "this month". Fixed (month-to-date periods, budgets derived from actuals).
6. Advisor said "last 3 months" while meaning full calendar months, which differed from the UI's month-to-date period. Labels and links now state the exact period.

## Not covered by automated tests

- Real email delivery (no provider configured; the dev mailbox is used in tests).
- The live Claude API path of the advisor (no API key in this environment; the demo-mode path and the "not configured" state are tested). The live path has typed error handling but was **not executed**.
- Meta and Google Ads live sync (not implemented; see STATUS.md).
- Installation on a physical Android device, and cross-browser runs (Firefox/Safari).
- Load and performance testing.
