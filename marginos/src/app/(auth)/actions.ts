"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { dummyHash, hashPassword, hashToken, newToken, verifyPassword } from "@/lib/auth/crypto";
import { createSession, destroySession, getSession, setActiveOrg } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { audit } from "@/lib/audit";

export type AuthState = { error?: string; fieldErrors?: Record<string, string>; message?: string } | null;

const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const password = z.string().min(10, "Use at least 10 characters").max(200).regex(/[A-Za-z]/, "Include a letter").regex(/[0-9]/, "Include a number");
const email = z.string().trim().toLowerCase().email("Enter a valid email").max(200);

function fieldErrors(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[i.path.join(".")] ??= i.message;
  return out;
}
const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : null);

export async function signupAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = z.object({ name: z.string().trim().min(2, "Enter your name").max(100), email, password }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!rateLimit(`signup:${await ip()}`, 10, 60 * 60_000).ok) return { error: "Too many attempts. Try again later." };
  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { fieldErrors: { email: "An account with this email already exists. Sign in instead." } };
  const user = await db.user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password) } });
  await createSession(user.id);
  redirect("/onboarding");
}

export async function loginAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password") }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const key = `login:${await ip()}:${parsed.data.email}`;
  if (!rateLimit(key, 8, 15 * 60_000).ok) return { error: "Too many sign-in attempts. Wait 15 minutes and try again." };
  const user = await db.user.findUnique({ where: { email: parsed.data.email }, include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } } });
  // Constant-ish time: always run bcrypt.
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? dummyHash());
  if (!user || !ok) return { error: "Incorrect email or password." };
  await createSession(user.id, user.memberships[0]?.orgId);
  const m = user.memberships[0];
  redirect(safeNext(fd.get("next")) ?? (m?.role === "CLIENT" ? "/portal" : "/dashboard"));
}

export async function demoLoginAction(): Promise<AuthState> {
  const user = await db.user.findUnique({ where: { email: "demo@marginos.app" }, include: { memberships: true } });
  if (!user || !user.memberships.length) return { error: "Demo workspace is not seeded. Run `npm run db:seed`." };
  await createSession(user.id, user.memberships[0].orgId);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function forgotPasswordAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!rateLimit(`forgot:${await ip()}`, 5, 15 * 60_000).ok) return { error: "Too many requests. Try again later." };
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const token = newToken();
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) } });
    await sendEmail(user.email, "Reset your MarginOS password",
      `Hi ${user.name},\n\nReset your password using this link (valid for 1 hour):\n${appUrl()}/reset-password/${token}\n\nIf you didn't request this, ignore this email.`);
  }
  // Same response either way — don't reveal which emails have accounts.
  return { message: "If an account exists for that email, a reset link has been sent." };
}

export async function resetPasswordAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = z.object({ token: z.string().min(10), password }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const t = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
  if (!t || t.usedAt || t.expiresAt < new Date()) return { error: "This reset link is invalid or has expired. Request a new one." };
  await db.$transaction([
    db.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(parsed.data.password) } }),
    db.passwordResetToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: t.userId } }), // sign out everywhere
  ]);
  const m = await db.membership.findFirst({ where: { userId: t.userId } });
  await createSession(t.userId, m?.orgId);
  redirect(m?.role === "CLIENT" ? "/portal" : "/dashboard");
}

export async function acceptInviteAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const token = String(fd.get("token") ?? "");
  const inv = await db.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return { error: "This invitation is invalid or has expired." };
  let user = await db.user.findUnique({ where: { email: inv.email } });
  if (user) {
    const session = await getSession();
    if (session?.userId !== user.id) {
      const pw = String(fd.get("password") ?? "");
      if (!(await verifyPassword(pw, user.passwordHash))) return { fieldErrors: { password: "Incorrect password for this account." } };
    }
  } else {
    const parsed = z.object({ name: z.string().trim().min(2, "Enter your name").max(100), password }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    user = await db.user.create({ data: { email: inv.email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) } });
  }
  await db.$transaction([
    db.membership.upsert({
      where: { userId_orgId: { userId: user.id, orgId: inv.orgId } },
      create: { userId: user.id, orgId: inv.orgId, role: inv.role, clientId: inv.clientId },
      update: { role: inv.role, clientId: inv.clientId },
    }),
    db.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
  ]);
  await audit({ orgId: inv.orgId, userId: user.id }, "invitation.accepted", "Membership", user.id, { role: inv.role });
  const session = await getSession();
  if (session?.userId === user.id) await setActiveOrg(session.id, inv.orgId);
  else await createSession(user.id, inv.orgId);
  redirect(inv.role === "CLIENT" ? "/portal" : "/dashboard");
}

export async function switchOrgAction(orgId: string) {
  const s = await getSession();
  if (!s) redirect("/login");
  const m = await db.membership.findUnique({ where: { userId_orgId: { userId: s.userId, orgId } } });
  if (m) await setActiveOrg(s.id, orgId);
  redirect(m?.role === "CLIENT" ? "/portal" : "/dashboard");
}
