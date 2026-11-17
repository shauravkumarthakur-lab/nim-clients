import { LogoMark } from "@/components/logo";
export const metadata = { title: "Offline" };
export default function Offline() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <LogoMark size={40} className="mx-auto" />
        <h1 className="mt-4 text-xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 max-w-xs text-sm text-muted">MarginOS needs a connection to show live financial data — figures are never served from a stale cache. Reconnect and try again.</p>
      </div>
    </div>
  );
}
