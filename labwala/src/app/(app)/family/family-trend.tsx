"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Series = { name: string; color: string; points: { d: string; v: number }[] };

/** Several family members on one chart; the shaded band is the lab's printed range. */
export function FamilyTrend({ series, low, high, unit }: { series: Series[]; low: number; high: number; unit: string }) {
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.d)))].sort();
  const data = dates.map((d) => Object.fromEntries([["d", d], ...series.map((s) => [s.name, s.points.find((p) => p.d === d)?.v ?? null])]));
  const values = series.flatMap((s) => s.points.map((p) => p.v)).concat([low, high]);
  const pad = (Math.max(...values) - Math.min(...values)) * 0.2 || 1;
  return (
    <div className="h-52 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -14 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <ReferenceArea y1={low} y2={high} fill="var(--within)" fillOpacity={0.09} stroke="none" />
          <XAxis dataKey="d" tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
          <YAxis domain={[Math.max(0, Math.min(...values) - pad), Math.max(...values) + pad]} tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => String(+v.toFixed(1))} />
          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 13 }} formatter={(v) => [`${v} ${unit}`]} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
          {series.map((s) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2.4} dot={{ r: 4, fill: "var(--surface)", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
