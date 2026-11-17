import { execSync } from "node:child_process";

/**
 * Prepare the isolated test database non-destructively:
 * apply pending migrations, then (re)seed the demo organisation (idempotent — it only
 * rebuilds the isDemo org). Every test creates its own agencies with unique emails,
 * so no destructive reset is needed between runs.
 */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgresql://marginos:marginos_dev@localhost:5432/marginos_test?schema=public";
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
