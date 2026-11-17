import * as React from "react";
import Link from "next/link";
import { cn } from "./cn";

const variants = {
  primary: "bg-fg text-bg hover:opacity-90 dark:bg-fg dark:text-bg",
  brand: "bg-brand text-brand-fg hover:opacity-90",
  secondary: "bg-surface border border-border-strong text-fg hover:bg-surface-2",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-loss text-white hover:opacity-90",
} as const;
const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-[15px]", icon: "h-9 w-9" } as const;

type Common = { variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string };
export const buttonClass = ({ variant = "primary", size = "md", className }: Common = {}) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition select-none",
    "disabled:opacity-50 disabled:pointer-events-none",
    variants[variant], sizes[size], className,
  );

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & Common>(
  ({ variant, size, className, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={buttonClass({ variant, size, className })} {...props} />
  ),
);
Button.displayName = "Button";

export function LinkButton({ href, variant, size, className, children, ...rest }: Common & { href: string; children: React.ReactNode; prefetch?: boolean; target?: string }) {
  return <Link href={href} className={buttonClass({ variant, size, className })} {...rest}>{children}</Link>;
}
