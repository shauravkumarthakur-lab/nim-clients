import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { devMailboxEnabled } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dev mailbox" };

/** Development-only view of emails "sent" while no email provider is configured. */
export default async function Mailbox() {
  if (!devMailboxEnabled()) notFound();
  const mails = await db.outboundEmail.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Dev mailbox</h1>
      <p className="mt-1 text-sm text-muted">Development only. Disabled in production unless ENABLE_DEV_MAILBOX=1.</p>
      <ul className="mt-6 flex flex-col gap-3">
        {mails.map((m) => (
          <li key={m.id} className="card p-4 text-sm" data-testid="mail">
            <p className="font-medium">{m.subject}</p>
            <p className="text-[12px] text-muted">To {m.to} · {m.createdAt.toLocaleString()}</p>
            <pre className="mt-2 whitespace-pre-wrap break-all font-sans text-[13px]">{m.body}</pre>
          </li>
        ))}
      </ul>
    </main>
  );
}
