"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TrendPoint = { date: string; value: number; low: number | null; high: number | null; lab: string | null };

/** One test over time. Shaded band = the most recent lab's printed range (labs can differ). */
export function TrendChart({ points, unit }: { points: TrendPoint[]; unit: string | null }) {
  const last = points.at(-1)!;
  const values = points.map((p) => p.value).concat([last.low, last.high].filter((x): x is number => x !== null));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || Math.abs(max) || 1) * 0.25;
  return (
    <div className="h-44 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          {last.low !== null && last.high !== null && <ReferenceArea y1={last.low} y2={last.high} fill="var(--within)" fillOpacity={0.08} stroke="none" />}
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
          <YAxis domain={[Math.max(0, min - pad), max + pad]} tick={{ fontSize: 12, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => String(+v.toFixed(2))} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 13 }}
            formatter={(v) => [`${v} ${unit ?? ""}`, ""]}
            labelFormatter={(l, p) => `${l}${p?.[0]?.payload?.lab ? ` · ${p[0].payload.lab}` : ""}`}
          />
          <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2.2} dot={{ r: 4, fill: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
