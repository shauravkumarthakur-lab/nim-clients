# Deployment guide

> **Status:** MarginOS has been built and verified locally as a production build (`next build && next start`). It has **not** been deployed to a public host from this session, because no hosting or database credentials were available. Follow the steps below to deploy.

## Recommended: Vercel + managed PostgreSQL (Neon or Supabase)

1. **Create a database.** Neon (neon.tech) or Supabase, in the Mumbai (ap-south-1) region for India/Nepal latency. Copy the pooled connection string. For Neon/Supabase poolers, append `?pgbouncer=true&connection_limit=1` to `DATABASE_URL`, and set `DIRECT_URL` to the non-pooled string if you add `directUrl` to `schema.prisma` for migrations.
2. **Push the code** (the `marginos/` folder) to a GitHub repository.
3. **Import into Vercel.** Framework: Next.js. Root directory: `marginos`.
4. **Set environment variables** (Production + Preview):
   - `DATABASE_URL`: from step 1
   - `APP_URL`: e.g. `https://app.yourdomain.com`
   - `ANTHROPIC_API_KEY`: optional, enables the AI advisor
5. **Build command:** `npx prisma migrate deploy && next build` (applies migrations on each deploy).
6. **Seed the demo workspace** (optional, once): run `DATABASE_URL=… npm run db:seed` from your machine.
7. **Custom domain + HTTPS:** add the domain in Vercel. HTTPS is required for the PWA install prompt on Android.
8. **Verify:** `GET https://your-domain/api/health` → `{"ok":true,"db":"connected"}`. Then sign up, onboard, and check the Install prompt on Android.

## Any Node host (Railway, Render, Fly.io, a VPS, Docker)

```bash
npm ci
npx prisma migrate deploy
npm run build
PORT=3000 npm start
```
Put it behind HTTPS (Caddy, nginx or the platform's TLS). Node 20+.

## Production checklist

- [ ] `DATABASE_URL` uses a least-privilege DB user and TLS (`sslmode=require`).
- [ ] `APP_URL` is the public HTTPS origin (invite and reset links use it).
- [ ] Do **not** set `ENABLE_DEV_MAILBOX` or `DISABLE_RATE_LIMIT` in production.
- [ ] Configure an email provider (see STATUS.md). Until then, reset and invite links are logged server-side, and invite links are shown to the admin in-app.
- [ ] Multiple instances: replace the in-memory rate limiter (`src/lib/rate-limit.ts`) with Redis/Upstash.
- [ ] Decide whether the public demo workspace should exist in production. If so, seed it; anyone with the demo password can reset it.

## Backups & recovery

- Enable your provider's automated daily backups plus point-in-time recovery (Neon/Supabase/RDS all support PITR). Keep at least 7–30 days.
- Logical backup: `pg_dump --format=custom "$DATABASE_URL" > marginos-$(date +%F).dump`
- Restore into a fresh database: `pg_restore --clean --no-owner -d "$NEW_DATABASE_URL" marginos-YYYY-MM-DD.dump`, then point `DATABASE_URL` at it.
- Test a restore quarterly. Audit logs are in `AuditLog` and are included in backups.
- Migrations are forward-only and versioned in `prisma/migrations`. Always back up before `migrate deploy` in production.
