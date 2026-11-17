import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/crypto";
import { getSession } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/rbac";
import { AuthForm } from "../../auth-form";
import { acceptInviteAction } from "../../actions";

export const metadata = { title: "Accept invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await db.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { org: { select: { name: true } } } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date())
    return <><h1 className="text-2xl font-semibold">Invitation unavailable</h1><p className="mt-2 text-sm text-muted">This link is invalid, expired or already used. Ask the sender for a new invitation.</p></>;
  const existing = await db.user.findUnique({ where: { email: inv.email } });
  const session = await getSession();
  const signedInAsInvitee = session?.userId && existing && session.userId === existing.id;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Join {inv.org.name}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">You&apos;ve been invited as <b>{ROLE_LABELS[inv.role]}</b> ({inv.email}).</p>
      <AuthForm testId="invite-form" action={acceptInviteAction} submit="Accept invitation" hidden={{ token }}
        fields={signedInAsInvitee ? [] : existing
          ? [{ name: "password", label: "Your password", type: "password", autoComplete: "current-password", hint: "You already have a MarginOS account." }]
          : [{ name: "name", label: "Your name", autoComplete: "name" }, { name: "password", label: "Choose a password", type: "password", autoComplete: "new-password", hint: "At least 10 characters, with a letter and a number." }]} />
    </>
  );
}
