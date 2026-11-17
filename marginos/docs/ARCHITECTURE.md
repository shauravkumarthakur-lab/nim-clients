# Architecture & technical decisions

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15.5 (App Router), React 19, TypeScript (strict) | One deployable unit with server components, server actions and route handlers. Mature and Vercel-native. |
| Styling | Tailwind CSS v4 + CSS-variable design tokens | Light and dark themes from one token set; no runtime CSS-in-JS. |
| UI primitives | Hand-built components (`src/components/ui`) + Radix Dialog/Dropdown, lucide icons | Small, accessible and consistent. Native `<select>` for best Android behaviour. |
| Database | PostgreSQL + Prisma 6 | Relational integrity for financial data; typed queries; versioned migrations in `prisma/migrations`. |
| Money | `Decimal(14,2)` columns + `decimal.js` in the engine | No floating-point arithmetic anywhere in financial calculations. |
| Validation | Zod on every server action and import | Server-side validation and sanitisation regardless of client. |
| Auth | Custom DB sessions (bcrypt-12 passwords, 256-bit random tokens stored as SHA-256 hashes, httpOnly SameSite=Lax cookies) | Full control over multi-tenant membership and roles; no third-party auth dependency. |
| Charts | Recharts | Themed via a palette hook so charts follow light and dark mode. |
| AI | `@anthropic-ai/sdk`, model `claude-opus-5-5` (configurable) | Interprets engine output only. Server-side fallback enabled; no tools, so it cannot write. |
| Tests | Vitest (unit) + Playwright (e2e, desktop + Pixel 7) | See `TEST_REPORT.md`. |
| PWA | `app/manifest.ts`, generated icons (incl. maskable), `public/sw.js` | Installable on Android Chrome. Network-only for pages, so financial data is never cached on the device. |

## Layout

```
marginos/
├─ prisma/schema.prisma, migrations/, seed.ts
├─ src/
│  ├─ app/
│  │  ├─ (auth)/          login, signup, forgot/reset password, invitations + actions
│  │  ├─ onboarding/      5-screen guided setup
│  │  ├─ (app)/           authenticated agency app: one folder per module, each with page.tsx + actions.ts
│  │  ├─ portal/          client portal (CLIENT role only)
│  │  ├─ api/             export/[entity], import/[entity], health
│  │  └─ manifest.ts, offline/, forbidden/, dev/mailbox
│  ├─ lib/
│  │  ├─ finance/engine.ts      ← pure deterministic calculation engine (unit-tested)
│  │  ├─ finance/load.ts        ← loads one org's records → engine inputs
│  │  ├─ finance/analytics.ts   ← composes engine results for pages
│  │  ├─ tenant.ts, rbac.ts, action.ts, owned.ts, audit.ts, rate-limit.ts
│  │  ├─ reports.ts             ← one builder for report pages and CSV exports
│  │  ├─ advisor/               facts (verified), demo (rule-based), llm (Claude)
│  │  ├─ demo/                  demo-organisation generator + reset
│  │  └─ integrations/          ad-platform connector interface (not live)
│  └─ components/        ui/, shell/, charts/, forms.ts (field definitions)
└─ tests/unit, tests/e2e
```

## Multi-tenancy & security model

- Every tenant table has `orgId`. **The org is never taken from request input.** `getCtx()` resolves it from the session and a `Membership` row (`src/lib/tenant.ts`).
- Every read filters by `ctx.orgId`. Every update and delete uses `updateMany` / `deleteMany` with `{ id, orgId }`, so a foreign id matches zero rows.
- Every foreign key in a write (client, project, employee, category…) is checked by `assertOwned()` against the caller's org. This prevents IDOR via tampered forms, and an e2e test proves it.
- Denormalised relations are resolved server-side. For example, an expense's client is always derived from its project, so a cost cannot belong to two clients.
- **RBAC**: one permission matrix (`src/lib/rbac.ts`) for 6 roles: Owner, Admin, Finance, Manager, Member, Client. Pages call `requireCtx(perm)`; actions call `defineAction(perm, schema, fn)`; route handlers use `can()`.
- **Client portal**: queries are pinned to `(orgId, clientId)` and to records the agency explicitly flagged `sharedWithClient`. Internal costs, salaries and margins never reach portal pages or shared report snapshots.
- **Audit log** for sensitive changes: salaries, invoices, payments and refunds, deletions, role changes, invitations, imports, demo resets, and portal approvals.
- **Rate limiting** (in-memory fixed window) on login, signup, password reset, invitations, imports, advisor and demo reset. Use Redis or Upstash for multi-instance deployments.
- Security headers: `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, Referrer and Permissions policies, HSTS in production, `X-Powered-By` removed. Next.js server actions also enforce same-origin (CSRF).
- CSV exports neutralise spreadsheet formula injection. CSV imports validate every row and commit all rows or none.
- Password reset: single-use, 1-hour tokens; same response for unknown emails (no account enumeration); all sessions revoked on reset. Login runs bcrypt even for unknown users (timing equalisation).

## Key decisions

1. **Deterministic engine separated from AI.** All numbers come from `engine.ts`. The advisor gets a JSON facts bundle with record links; the model is told to label Actual vs Estimate, use only provided figures, and never claim to act.
2. **Time entries snapshot the loaded cost rate**, so salary changes don't rewrite historical project costs.
3. **Payroll is not an expense record.** It is computed from employee salaries prorated by days employed, which avoids double counting with logged labour (see FINANCIAL_MODEL.md).
4. **Periods never extend into the future.** "This month" means month-to-date, so payroll and capacity aren't charged for days that haven't happened.
5. **Alerts are computed live, not stored.** They can never drift out of sync with the underlying data.
6. **Demo data lives only in an `isDemo` organisation.** Reset refuses to touch non-demo orgs.
7. **Metadata is rendered in `<head>` for all user agents** (`htmlLimitedBots: /.*/`). Next 15 otherwise streams it into `<body>`, and Chrome then doesn't detect the PWA manifest. The e2e installability test caught this.
