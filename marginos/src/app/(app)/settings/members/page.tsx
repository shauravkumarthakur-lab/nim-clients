import { requireCtx } from "@/lib/tenant";
import { db } from "@/lib/db";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/rbac";
import { date } from "@/lib/format";
import { options } from "@/lib/options";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmAction, FormDialog } from "@/components/ui/form-dialog";
import { SettingsTabs } from "../tabs";
import { changeRole, inviteMember, removeMember, revokeInvitation } from "../actions";

export const metadata = { title: "Members" };
const INTERNAL = ["OWNER", "ADMIN", "FINANCE", "MANAGER", "MEMBER"] as const;

export default async function MembersPage() {
  const ctx = await requireCtx("MANAGE_ORG");
  const [members, invites, opts] = await Promise.all([
    db.membership.findMany({ where: { orgId: ctx.orgId }, include: { user: { select: { name: true, email: true } }, client: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    db.invitation.findMany({ where: { orgId: ctx.orgId, acceptedAt: null }, orderBy: { createdAt: "desc" } }),
    options(ctx.orgId),
  ]);
  return (
    <>
      <PageHeader title="Settings" description="Members & permissions" actions={
        <FormDialog title="Invite member" triggerLabel="Invite member" action={inviteMember} testId="invite-member" submitLabel="Create invitation"
          fields={[
            { name: "email", label: "Email", type: "email", required: true, full: true },
            { name: "role", label: "Role", type: "select", required: true, options: (["ADMIN", "FINANCE", "MANAGER", "MEMBER", "CLIENT"] as const).map((r) => ({ value: r, label: `${ROLE_LABELS[r]} — ${ROLE_DESCRIPTIONS[r]}` })), full: true },
            { name: "clientId", label: "Client (portal users only)", type: "select", options: opts.clients, full: true },
          ]} defaults={{ role: "MEMBER" }} />
      } />
      <SettingsTabs active="members" />
      <Card>
        <CardHeader title="Members" description={`${members.length} people have access`} />
        <DataTable testId="members-table" rows={members} rowKey={(m) => m.id} columns={[
          { key: "n", header: "Name", primary: true, cell: (m) => <span>{m.user.name}{m.userId === ctx.userId ? <span className="text-subtle"> (you)</span> : null}</span> },
          { key: "e", header: "Email", cell: (m) => m.user.email },
          { key: "r", header: "Role", highlight: true, cell: (m) => <Badge tone={m.role === "CLIENT" ? "info" : m.role === "OWNER" ? "brand" : "neutral"}>{ROLE_LABELS[m.role]}{m.client ? ` · ${m.client.name}` : ""}</Badge> },
          { key: "d", header: "Joined", cell: (m) => date(m.createdAt) },
          { key: "actions", header: "", cell: (m) => m.userId === ctx.userId ? null : (
            <div className="flex justify-end gap-1">
              {m.role !== "CLIENT" ? <FormDialog mode="edit" title="Change role" action={changeRole} fields={[{ name: "id", label: "id", type: "hidden" }, { name: "role", label: "Role", type: "select", required: true, full: true, options: INTERNAL.map((r) => ({ value: r, label: `${ROLE_LABELS[r]} — ${ROLE_DESCRIPTIONS[r]}` })) }]} defaults={{ id: m.id, role: m.role }} /> : null}
              <ConfirmAction action={removeMember} payload={{ id: m.id }} label="Remove" title="Remove member?" description={`${m.user.name} will immediately lose access to this workspace.`} confirmLabel="Remove" />
            </div>) },
        ]} />
      </Card>
      <Card className="mt-5">
        <CardHeader title="Pending invitations" />
        <DataTable rows={invites} rowKey={(i) => i.id} empty={<p className="px-5 py-6 text-sm text-muted">No pending invitations.</p>} columns={[
          { key: "e", header: "Email", primary: true, cell: (i) => i.email },
          { key: "r", header: "Role", cell: (i) => ROLE_LABELS[i.role] },
          { key: "x", header: "Expires", highlight: true, cell: (i) => (i.expiresAt < new Date() ? <Badge tone="loss">Expired</Badge> : date(i.expiresAt)) },
          { key: "actions", header: "", cell: (i) => <div className="flex justify-end"><ConfirmAction action={revokeInvitation} payload={{ id: i.id }} label="Revoke" title="Revoke invitation?" description={`The link sent to ${i.email} will stop working.`} confirmLabel="Revoke" /></div> },
        ]} />
      </Card>
      <Card className="mt-5">
        <CardHeader title="What each role can do" />
        <CardBody><ul className="grid gap-2 text-[13px] sm:grid-cols-2">{Object.entries(ROLE_DESCRIPTIONS).map(([r, d]) => <li key={r}><b>{ROLE_LABELS[r as keyof typeof ROLE_LABELS]}</b> — <span className="text-muted">{d}</span></li>)}</ul></CardBody>
      </Card>
    </>
  );
}
