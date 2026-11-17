import { LinkButton } from "@/components/ui/button";
export const metadata = { title: "No access" };
export default function Forbidden() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-sm font-medium text-loss">403</p>
        <h1 className="mt-2 text-2xl font-semibold">You don&apos;t have access to this page</h1>
        <p className="mt-2 text-sm text-muted">Your role in this workspace doesn&apos;t include it. Ask an owner or admin if you need access.</p>
        <LinkButton href="/time" className="mt-6">Go to time tracking</LinkButton>
      </div>
    </div>
  );
}
