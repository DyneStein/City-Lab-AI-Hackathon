import { Eye, EyeOff, Lightbulb, ShieldCheck, ShieldHalf, UserRoundCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { DEMO_MEMBERS, DEMO_TRENDS } from "@/lib/demo/family";
import { testDisplayName } from "@/lib/knowledge/library";
import { Card, LargeTitle, cx } from "@/components/ui";
import { FamilyTrend } from "./family-trend";

const COLORS = { you: "var(--accent)", nani: "#b4531f", ahmed: "#4a5468", abbu: "#7b8394", bilal: "#2f6f4f" } as const;

export default async function FamilyPage() {
  await requireUser();
  const { t, lang } = await getDict();
  const f = t.family;
  const byGen = [0, 1, 2].map((g) => DEMO_MEMBERS.filter((m) => m.generation === g));
  const shareIcon = { summary: Eye, flagged: ShieldHalf, none: EyeOff, guardian: UserRoundCheck } as const;

  return (
    <>
      <LargeTitle title={f.title} action={<span className="rounded-full bg-outside-soft px-3 py-1 text-[13px] font-medium text-outside">{f.sample}</span>} />
      <p className="-mt-3 mb-6 text-[14px] leading-relaxed text-ink-3">{f.sampleNote}</p>

      {/* Family tree */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-[14px] font-semibold text-ink-2">{f.tree}</h2>
        <Card className="relative p-5">
          <div className="flex flex-col items-center gap-7">
            {byGen.map((row, gi) => (
              <div key={gi} className="relative flex justify-center gap-4">
                {gi > 0 && <span aria-hidden className="absolute -top-7 left-1/2 h-7 w-px bg-line-strong" />}
                {row.length > 1 && <span aria-hidden className="absolute left-1/2 top-7 h-px w-[calc(100%-72px)] -translate-x-1/2 bg-line-strong" />}
                {row.map((m) => (
                  <div key={m.id} className="relative flex w-[76px] flex-col items-center text-center">
                    <span
                      className={cx("grid size-14 place-items-center rounded-full text-[19px] font-semibold text-white shadow-[var(--shadow)]", m.you && "ring-4 ring-accent/25")}
                      style={{ background: COLORS[m.id as keyof typeof COLORS] }}
                    >
                      {m.initials}
                    </span>
                    <span className="mt-1.5 text-[14px] font-medium leading-tight text-ink">{m.name[lang]}</span>
                    <span className="text-[12px] text-ink-3">{m.relation[lang]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Consent: who shares what */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-[14px] font-semibold text-ink-2">{f.sharing}</h2>
        <ul className="overflow-hidden rounded-[18px] bg-surface shadow-[var(--shadow)] divide-y divide-line">
          {DEMO_MEMBERS.filter((m) => !m.you).map((m) => {
            const Icon = shareIcon[m.sharing];
            return (
              <li key={m.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full text-[14px] font-semibold text-white" style={{ background: COLORS[m.id as keyof typeof COLORS] }}>
                  {m.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] text-ink">{m.name[lang]}</span>
                  <span className="block text-[13px] text-ink-3">{m.relation[lang]}</span>
                </span>
                <span className={cx("flex items-center gap-1.5 text-[13px]", m.sharing === "none" ? "text-ink-3" : "text-accent")}>
                  <Icon className="size-4" aria-hidden />
                  {f.share[m.sharing]}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 flex gap-1.5 px-1 text-[13px] leading-relaxed text-ink-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          {f.privacy}
        </p>
      </section>

      {/* Shared trends */}
      <section className="mb-7">
        <h2 className="mb-1 px-1 text-[14px] font-semibold text-ink-2">{f.trends}</h2>
        <p className="mb-2 px-1 text-[13px] text-ink-3">{f.trendsHint}</p>
        <div className="flex flex-col gap-3">
          {DEMO_TRENDS.map((tr) => (
            <Card key={tr.key} className="p-4">
              <p className="mb-2 text-[16px] font-medium text-ink">
                {testDisplayName(tr.key, tr.key, lang)} <span className="ltr-num text-[13px] text-ink-3">({tr.unit})</span>
              </p>
              <FamilyTrend
                low={tr.low}
                high={tr.high}
                unit={tr.unit}
                series={tr.series.map((s) => {
                  const m = DEMO_MEMBERS.find((x) => x.id === s.member)!;
                  return { name: m.name[lang], color: COLORS[s.member as keyof typeof COLORS], points: s.points.map(([d, v]) => ({ d, v })) };
                })}
              />
            </Card>
          ))}
        </div>
      </section>

      <Card className="mb-4 flex gap-3 bg-accent-soft p-4 shadow-none">
        <Lightbulb className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div>
          <p className="text-[15px] font-semibold text-ink">{f.observation}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">{f.observationText}</p>
        </div>
      </Card>
    </>
  );
}
