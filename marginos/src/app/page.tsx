import { redirect } from "next/navigation";
import { Logo, LogoMark } from "@/components/logo";
import { LinkButton } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";

export default async function Landing() {
  if (await getSession()) redirect("/dashboard");
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <LinkButton href="/login" variant="ghost" size="sm">Sign in</LinkButton>
          <LinkButton href="/signup" size="sm">Start free</LinkButton>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5">
        <section className="grid items-center gap-10 py-14 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-widest text-brand">Agency financial intelligence</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">Know your margins.<br />Control your agency.</h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted">
              You know what you invoice. MarginOS shows what you actually keep — after every hour, freelancer, shoot day,
              revision and rupee of overhead — for every client, project, person and deliverable.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/signup" size="lg">Set up your agency</LinkButton>
              <LinkButton href="/login" size="lg" variant="secondary">Explore the demo</LinkButton>
            </div>
          </div>
          <div className="card p-5">
            <p className="text-[12px] uppercase tracking-wide text-subtle">One retainer, honestly measured</p>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              {[["Invoiced", "₹1,60,000", ""], ["Team time (62 h × loaded cost)", "− ₹38,400", "text-muted"], ["Freelancers & shoot costs", "− ₹41,600", "text-muted"], ["Unbilled extra revisions", "− ₹12,800", "text-loss"], ["Contribution", "₹67,200 · 42%", "font-semibold text-brand"]].map(([a, b, c]) => (
                <div key={a} className={`flex justify-between border-b border-border pb-2 last:border-0 ${c}`}><dt>{a}</dt><dd className="num">{b}</dd></div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] text-subtle">Illustrative example.</p>
          </div>
        </section>
        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Client profitability", "See which retainers fund the studio — and which quietly drain it."],
            ["Production economics", "The real cost of one reel, one shoot day, one brand identity."],
            ["Scope creep radar", "Every extra revision and unplanned shoot, priced and turned into a change request."],
            ["AI business advisor", "Ask questions in plain English. Answers cite your own verified numbers."],
          ].map(([t, d]) => (
            <div key={t} className="card p-5"><LogoMark size={22} /><p className="mt-3 font-medium">{t}</p><p className="mt-1 text-sm text-muted">{d}</p></div>
          ))}
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-[12px] text-subtle">MarginOS · Management reporting for agencies — not an accounting or tax-compliance system.</footer>
    </div>
  );
}
