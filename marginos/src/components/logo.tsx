/**
 * MarginOS mark: a revenue bar over a cost bar — the teal slice is the margin.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--fg)" />
      <rect x="7" y="9.5" width="18" height="4.5" rx="1.5" fill="var(--bg)" />
      <rect x="7" y="18" width="11" height="4.5" rx="1.5" fill="var(--bg)" opacity="0.55" />
      <rect x="19" y="18" width="6" height="4.5" rx="1.5" fill="var(--brand)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={"inline-flex items-center gap-2 " + (className ?? "")}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">Margin<span className="text-brand">OS</span></span>
    </span>
  );
}
