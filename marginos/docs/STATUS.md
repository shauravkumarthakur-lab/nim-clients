# Feature status, gaps & required credentials

Legend: ✅ **Fully functional** (real data, persisted, tested) · 🟡 **Demo / simulated** (works, clearly labelled, no external service) · 🔌 **Awaiting external integration** (architecture in place, needs credentials and implementation)

## Modules

| Module | Status | Notes |
|---|---|---|
| A. Sign up, login, logout, sessions | ✅ | DB sessions, bcrypt, rate-limited |
| A. Forgot / reset password | ✅ / 🟡 | Flow is complete. **Email delivery is simulated**: messages go to `OutboundEmail` + server log (`/dev/mailbox` in dev). Needs an email provider. |
| A. Organisation creation, onboarding (9 items), settings | ✅ | INR and NPR; currency list is extensible in `lib/constants` |
| A. Invitations, 6 roles, permissions | ✅ | Invite link shown to the admin in-app (works without email) |
| B. Dashboard, date filters, drill-down | ✅ | All figures computed from records |
| C. Client profitability (+ trend, overhead, pricing hint) | ✅ | |
| D. Project profitability, budget vs actual, warnings | ✅ | |
| E. Creative production economics | ✅ | |
| F. Scope creep, alerts, change requests → quote → approve → invoice | ✅ | |
| G. Employees, utilisation, loaded cost, freelancers | ✅ | |
| H. Expenses, categories, vendors, recurring, invoices, payments, refunds | ✅ | |
| H. CSV import (expenses, clients, time) / export (all lists + reports) | ✅ | |
| I. AI advisor: architecture, facts, read-only | ✅ | |
| I. AI advisor: answers without a key | 🟡 | Rule-based demo mode over real data, labelled |
| I. AI advisor: answers via Claude | 🔌 | Implemented; **needs `ANTHROPIC_API_KEY`**; not executed in this environment |
| J. Client portal (projects, reviews, change approvals, invoices, reports) | ✅ | |
| K. Media economics (manual entry) | ✅ | Media spend kept separate from revenue |
| K. Meta Ads / Google Ads live sync | 🔌 | Interface only (`src/lib/integrations`). UI shows "Not connected". Needs developer apps, OAuth, implementation. |
| L. Reports (9) + print-to-PDF + CSV | ✅ | PDF via the browser's print dialog (print stylesheet), no server-side PDF engine |
| Demo organisation + reset | ✅ | 8 clients, 12 projects, 10 employees, 5 freelancers, 104 deliverables, ~3.5 months of data |
| PWA (manifest, icons, SW, offline page) | ✅ | Chrome reports installable. Not installed on a physical phone from this session. |
| Light / dark theme | ✅ | System, light or dark via the user menu |
| Deployment | 🔌 | Production build verified locally; **not deployed** (needs host + DB credentials) |

## External credentials required

| Purpose | Variables | Without it |
|---|---|---|
| Database (required) | `DATABASE_URL` | App can't start |
| Public URL (required) | `APP_URL` | Links in emails/invites point to localhost |
| AI advisor | `ANTHROPIC_API_KEY` (+ optional `ADVISOR_MODEL`) | Demo mode |
| Email | none wired yet; add a provider in `src/lib/email/send.ts` (e.g. Resend, SES, Postmark) | Emails logged only |
| Meta Ads | `META_APP_ID`, `META_APP_SECRET` + implementation | Manual campaign entry |
| Google Ads | `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID/SECRET` + implementation | Manual campaign entry |
| Hosting | Vercel (or other) account | Run locally / self-host |

## Known limitations / next steps

- **Email provider**: implement `sendEmail()` for real delivery. Add email verification on signup.
- **File storage** (deliverable uploads for client review, receipts) is not implemented. Recommended: S3/R2 with signed URLs, scoped by `orgId`.
- **Rate limiting** is per-instance memory. Use Redis for horizontal scaling.
- **Invoices** are single-line management invoices, not statutory GST invoices (no HSN/SAC, GSTIN validation or e-invoicing). That is intentional; MarginOS isn't an accounting system.
- **Multi-currency per record and FX** are not supported; the currency is per workspace. Changing the workspace currency relabels, it doesn't convert.
- **2FA / SSO** not yet implemented.
- **Revenue recognition** uses invoice dates (billing basis). Retainers billed in advance are recognised when invoiced, not spread over the service period.
- Time entries can't be imported for employees without an email on their profile.
- Performance: each page loads the org's full dataset into the engine. That's fine for agencies up to tens of thousands of records. Beyond that, add aggregate SQL or materialised summaries.

## Development checklist (phases)

- [x] Phase 1: architecture, schema, roles, navigation
- [x] Phase 2: design system, responsive layout, all screens, light/dark
- [x] Phase 3: auth, models, actions/APIs, tenant isolation, calculation engine
- [x] Phase 4: every screen on real data; forms, filters, search, exports; demo data
- [x] Phase 5: AI advisor architecture, secure config, integration architecture
- [x] Phase 6: unit + e2e + mobile tests, defects fixed
- [~] Phase 7: production build, PWA, docs ✅ — public deployment and on-device install pending your credentials and phone
