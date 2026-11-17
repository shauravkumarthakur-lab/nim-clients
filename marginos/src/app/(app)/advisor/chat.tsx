"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ActionButton } from "@/components/ui/form-dialog";
import { askAdvisor, clearAdvisor } from "./actions";

const SUGGESTIONS = [
  "Which client is the least profitable?", "What is the actual cost of producing a reel?", "Which projects are exceeding budgets?",
  "How much unbilled work did we perform this month?", "Which employees are underutilised?", "Which clients should we renegotiate with?",
  "What happens to our margin if production costs increase by 15%?", "What does one shoot day cost us?",
];

/** Minimal safe markdown: escapes everything, supports **bold**, bullets and internal links only. */
function Md({ text }: { text: string }) {
  const inline = (s: string, k: string) => {
    const parts: React.ReactNode[] = [];
    const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/[^)\s]*)\)|_([^_]+)_/g;
    let last = 0; let m: RegExpExecArray | null; let i = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      if (m[1]) parts.push(<b key={`${k}b${i}`}>{m[1]}</b>);
      else if (m[2]) parts.push(<Link key={`${k}l${i}`} href={m[3]} className="text-brand underline underline-offset-2">{m[2]}</Link>);
      else if (m[4]) parts.push(<em key={`${k}e${i}`}>{m[4]}</em>);
      last = re.lastIndex; i++;
    }
    parts.push(s.slice(last));
    return parts;
  };
  const blocks = text.split(/\n{2,}/);
  return <div className="flex flex-col gap-2">{blocks.map((b, bi) => {
    const lines = b.split("\n");
    if (lines.every((l) => /^\s*[-*•]\s/.test(l))) return <ul key={bi} className="list-disc pl-5">{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*•]\s/, ""), `${bi}-${li}`)}</li>)}</ul>;
    return <p key={bi}>{lines.map((l, li) => <React.Fragment key={li}>{li ? <br /> : null}{inline(l.replace(/^#+\s*/, ""), `${bi}-${li}`)}</React.Fragment>)}</p>;
  })}</div>;
}

export function AdvisorChat({ initial }: { initial: { id: string; role: "user" | "assistant"; content: string }[] }) {
  const [q, setQ] = React.useState("");
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string>();
  const [optimistic, setOptimistic] = React.useState<string | null>(null);
  const router = useRouter();
  const end = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [initial.length, optimistic]);
  const ask = (question: string) => {
    if (!question.trim()) return;
    setError(undefined); setOptimistic(question); setQ("");
    start(async () => {
      const r = await askAdvisor(null, { question });
      if (!r.ok) setError(r.error);
      router.refresh();
      setOptimistic(null);
    });
  };
  return (
    <div className="card flex min-h-[60dvh] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" data-testid="advisor-messages">
        {!initial.length && !optimistic ? (
          <div className="py-6 text-center">
            <Sparkles className="mx-auto text-brand" />
            <p className="mt-2 font-medium">Ask about your agency&apos;s numbers</p>
            <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-border px-3 py-1.5 text-[13px] text-muted hover:border-brand hover:text-fg">{s}</button>)}
            </div>
          </div>
        ) : null}
        {initial.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl bg-fg px-4 py-2.5 text-sm text-bg" : "max-w-[95%] rounded-2xl bg-surface-2 px-4 py-3 text-sm"} data-testid={m.role === "assistant" ? "advisor-answer" : undefined}>
              {m.role === "assistant" ? <Md text={m.content} /> : m.content}
            </div>
          </div>
        ))}
        {optimistic ? <><div className="flex justify-end"><div className="max-w-[85%] rounded-2xl bg-fg px-4 py-2.5 text-sm text-bg">{optimistic}</div></div><div className="text-sm text-muted">Calculating…</div></> : null}
        {error ? <p className="rounded-md bg-loss-soft px-3 py-2 text-[13px] text-loss" role="alert">{error}</p> : null}
        <div ref={end} />
      </div>
      <form className="flex items-end gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <Textarea aria-label="Your question" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Which client should we renegotiate with?" className="min-h-11 flex-1 resize-none" rows={1} data-testid="advisor-input"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }} />
        <Button type="submit" size="icon" disabled={pending || !q.trim()} aria-label="Ask" data-testid="advisor-ask"><ArrowUp size={18} /></Button>
        {initial.length ? <ActionButton action={clearAdvisor} payload={{}} variant="ghost">Clear</ActionButton> : null}
      </form>
    </div>
  );
}
