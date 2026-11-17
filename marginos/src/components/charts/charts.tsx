"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Pie, PieChart,
} from "recharts";

const PALETTE = {
  light: { c1: "#0d8a78", c2: "#16181d", c3: "#c9a227", c4: "#6e7bd8", c5: "#d97757", grid: "#e8e8e2", text: "#8b8e95", loss: "#d93f3f", surface: "#ffffff", border: "#e4e4de" },
  dark: { c1: "#2cc5ae", c2: "#d7d9de", c3: "#e3bd45", c4: "#8ea2ff", c5: "#f08f6f", grid: "#23262c", text: "#6e717a", loss: "#ff6b6b", surface: "#131519", border: "#25282e" },
};
function usePalette() {
  const { resolvedTheme } = useTheme();
  const [m, setM] = React.useState(false);
  React.useEffect(() => { setM(true); }, []);
  return PALETTE[m && resolvedTheme === "dark" ? "dark" : "light"];
}

const compact = (currency: string) => (v: number) => {
  const a = Math.abs(v);
  const s = currency === "INR" ? "₹" : "Rs ";
  if (a >= 1e7) return `${v < 0 ? "−" : ""}${s}${(a / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${v < 0 ? "−" : ""}${s}${(a / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${v < 0 ? "−" : ""}${s}${(a / 1e3).toFixed(0)}k`;
  return `${s}${v.toFixed(0)}`;
};
const full = (currency: string) => (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

function ChartTooltip({ p, currency }: { p: typeof PALETTE.light; currency: string }) {
  return <Tooltip formatter={(v: number) => full(currency)(v)} contentStyle={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 8, fontSize: 12 }} cursor={{ fill: p.grid, opacity: 0.5 }} />;
}

export function RevenueExpenseChart({ data, currency }: { data: { month: string; revenue: number; expenses: number; netProfit: number }[]; currency: string }) {
  const p = usePalette();
  return (
    <div className="h-64 w-full sm:h-72" data-testid="chart-revenue-expenses">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={p.grid} />
          <XAxis dataKey="month" tick={{ fill: p.text, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={compact(currency)} tick={{ fill: p.text, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
          <ChartTooltip p={p} currency={currency} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenue" name="Revenue" fill={p.c1} radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="expenses" name="Total costs" fill={p.c2} radius={[4, 4, 0, 0]} maxBarSize={36} opacity={0.75} />
          <Line dataKey="netProfit" name="Net profit" stroke={p.c3} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBarChart({ data, currency, testId }: { data: { name: string; value: number }[]; currency: string; testId?: string }) {
  const p = usePalette();
  return (
    <div className="w-full" style={{ height: Math.max(160, data.length * 34 + 20) }} data-testid={testId}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={p.grid} />
          <XAxis type="number" tickFormatter={compact(currency)} tick={{ fill: p.text, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fill: p.text, fontSize: 11 }} axisLine={false} tickLine={false} />
          <ChartTooltip p={p} currency={currency} />
          <Bar dataKey="value" name="Value" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((d, i) => <Cell key={i} fill={d.value < 0 ? p.loss : p.c1} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MarginTrendChart({ data }: { data: { month: string; marginPct: number | null }[] }) {
  const p = usePalette();
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={p.grid} />
          <XAxis dataKey="month" tick={{ fill: p.text, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: p.text, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip formatter={(v: number) => `${v?.toFixed?.(1)}%`} contentStyle={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 8, fontSize: 12 }} />
          <Line dataKey="marginPct" name="Contribution margin" stroke={p.c1} strokeWidth={2} dot={{ r: 3 }} connectNulls type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data, currency }: { data: { name: string; value: number }[]; currency: string }) {
  const p = usePalette();
  const colors = [p.c1, p.c2, p.c3, p.c4, p.c5, p.text];
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={1} stroke="none">
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => full(currency)(v)} contentStyle={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 8, fontSize: 12 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
