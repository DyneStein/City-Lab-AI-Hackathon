import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { testDisplayName } from "@/lib/knowledge/library";
import { ButtonLink, cx } from "@/components/ui";
import { LangSwitcher } from "@/components/lang-switcher";
import { Logo } from "@/components/logo";

export default async function Landing() {
  const user = await getSessionUser();
  if (user) redirect(user.profile?.onboardedAt ? "/home" : "/onboarding");
  const { t, lang } = await getDict();

  const sample = [
    { key: "hemoglobin", value: "10.5", unit: "g/dL", range: "12.0 – 16.0", out: true },
    { key: "creatinine", value: "1.3", unit: "mg/dL", range: "0.6 – 1.1", out: true },
    { key: "tsh", value: "2.4", unit: "uIU/mL", range: "0.4 – 4.0", out: false },
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 lg:max-w-5xl">
      <header className="flex items-center justify-between py-5">
        <Logo label={t.appName} />
      </header>

      <main className="grid flex-1 gap-10 pb-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <section className="rise-in">
          <LangSwitcher current={lang} label={t.common.language} block className="mb-8 lg:max-w-sm" />
          <h1 className="font-display text-[40px] leading-[1.12] tracking-[-0.015em] text-ink lg:text-[54px]">{t.tagline}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{t.landing.lead}</p>
          <ul className="mt-7 flex flex-col gap-3">
            {t.landing.features.map((f) => (
              <li key={f} className="flex gap-3 text-[15.5px] leading-relaxed text-ink">
                <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section className="rise-in [animation-delay:120ms]" aria-label={t.landing.exampleLabel}>
          <div className="rounded-[24px] bg-surface p-5 shadow-[var(--shadow)]">
            <p className="text-[13px] font-medium text-ink-3">{t.landing.exampleLabel}</p>
            <ul className="mt-3 divide-y divide-line">
              {sample.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-4 py-3.5">
                  <span className="flex items-center gap-3">
                    <span className={cx("size-2.5 rounded-full", r.out ? "bg-outside" : "bg-within")} aria-hidden />
                    <span className="text-[16px] font-medium text-ink">{testDisplayName(r.key, r.key, lang)}</span>
                  </span>
                  <span className="text-end">
                    <span className="ltr-num block text-[17px] font-semibold text-ink" dir="ltr">
                      {r.value} <span className="text-[12.5px] font-normal text-ink-3">{r.unit}</span>
                    </span>
                    <span className="block text-[12.5px] text-ink-3">
                      {t.landing.labRange} <span className="ltr-num">{r.range}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-[16px] bg-surface-2 p-4 text-[15px] leading-relaxed text-ink">{t.landing.exampleText}</p>
          </div>
        </section>
      </main>

      {/* Primary actions in the thumb zone on phones */}
      <div className="sticky bottom-0 -mx-5 bg-bg/92 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur-xl lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pb-10">
        <div className="flex flex-col gap-2.5 lg:max-w-sm lg:flex-row">
          <ButtonLink href="/register" block>
            {t.auth.signUp}
          </ButtonLink>
          <ButtonLink href="/login" variant="ghost" block>
            {t.auth.signIn}
          </ButtonLink>
        </div>
        <p className="mt-3 text-center text-[12.5px] leading-relaxed text-ink-3 lg:text-start">{t.safety.disclaimer}</p>
      </div>
    </div>
  );
}
