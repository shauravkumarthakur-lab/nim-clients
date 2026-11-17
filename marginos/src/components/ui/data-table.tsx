import * as React from "react";
import Link from "next/link";
import { cn } from "./cn";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "right" | "left";
  className?: string;
  /** Shown as the card title on mobile. */
  primary?: boolean;
  /** Shown top-right on mobile cards. */
  highlight?: boolean;
  hideOnMobile?: boolean;
}

/**
 * Responsive table: a dense table on ≥ md screens, stacked cards on phones
 * (no horizontal page overflow on Android).
 */
export function DataTable<T>({ rows, columns, rowKey, rowHref, empty, footer, testId }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  rowHref?: (r: T) => string;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
  testId?: string;
}) {
  if (!rows.length) return <>{empty ?? <p className="px-4 py-8 text-center text-sm text-muted">No records yet.</p>}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const highlight = columns.find((c) => c.highlight);
  const rest = columns.filter((c) => c !== primary && c !== highlight && !c.hideOnMobile && c.key !== "actions");
  const actions = columns.find((c) => c.key === "actions");
  return (
    <div data-testid={testId}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-subtle">
              {columns.map((c) => (
                <th key={c.key} className={cn("px-4 py-2.5 font-medium whitespace-nowrap", c.align === "right" && "text-right", c.className)}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-2.5 align-middle", c.align === "right" && "text-right num whitespace-nowrap", c.className)}>
                    {c === primary && rowHref ? <Link className="font-medium hover:underline" href={rowHref(r)}>{c.cell(r)}</Link> : c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer ? <tfoot>{footer}</tfoot> : null}
        </table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 font-medium">
                {rowHref ? <Link href={rowHref(r)} className="hover:underline">{primary.cell(r)}</Link> : primary.cell(r)}
              </div>
              {highlight ? <div className="num shrink-0 text-right text-sm">{highlight.cell(r)}</div> : null}
            </div>
            {rest.length ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                {rest.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-subtle">{c.header}</dt>
                    <dd className={cn("truncate", c.align === "right" && "num")}>{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {actions ? <div className="mt-2 flex justify-end">{actions.cell(r)}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
