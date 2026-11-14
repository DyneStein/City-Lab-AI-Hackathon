"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { onboardingAction, setLanguageAction, updateProfileAction, type FormState } from "@/app/actions";
import { LANGS, fmt, type Dict, type Lang } from "@/lib/i18n/dictionaries";
import { Button, Field, Input, Select, cx } from "@/components/ui";

export type ProfileDefaults = {
  fullName?: string;
  dateOfBirth?: string | null;
  ageYears?: number | null;
  language: Lang;
  country?: string;
  region?: string | null;
  sex?: string | null;
  phone?: string | null;
  aiConsent?: boolean;
  voiceNotifications?: boolean;
};

const defaultCountry = (l: Lang) => (l === "en" ? "Pakistan" : "پاکستان");

/* ───────── Onboarding: one question group per step (less to think about at once) ───────── */

export function OnboardingFlow({ t, common, lang }: { t: Dict["onboarding"]; common: Dict["common"]; lang: Lang }) {
  const [state, action, pending] = useActionState<FormState, FormData>(onboardingAction, undefined);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, startLang] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const total = 4;

  function next() {
    const f = form.current!;
    if (step === 1) {
      const name = (f.elements.namedItem("fullName") as HTMLInputElement).value.trim();
      const dob = (f.elements.namedItem("dateOfBirth") as HTMLInputElement).value;
      const age = (f.elements.namedItem("ageYears") as HTMLInputElement).value;
      if (name.length < 2) return setError(t.required);
      if (!dob && !age) return setError(t.dobOrAge);
    }
    setError(null);
    setStep((s) => Math.min(total - 1, s + 1));
  }

  const serverError = state?.error ? (state.error === "dobOrAge" ? t.dobOrAge : common.error) : null;

  return (
    <form ref={form} action={action} className="flex min-h-[calc(100dvh-80px)] flex-col">
      {/* Progress */}
      <div className="mb-8 flex items-center gap-3">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} aria-label={common.back} className="-ms-2 grid size-11 place-items-center rounded-full text-ink hover:bg-surface-2">
            <ChevronLeft className="size-6 rtl:-scale-x-100" />
          </button>
        ) : (
          <span className="w-9" />
        )}
        <div className="flex flex-1 gap-1.5" aria-label={fmt(t.stepOf, { n: step + 1, total })}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cx("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-line")} />
          ))}
        </div>
        <span className="w-9" />
      </div>

      <div className="flex-1">
        {/* Step 1: language */}
        <section hidden={step !== 0} className="rise-in">
          <h1 className="font-display text-[30px] leading-[1.2] text-ink">{t.langTitle}</h1>
          <p className="mt-2 text-[15.5px] text-ink-2">{t.langHint}</p>
          <div className="mt-7 flex flex-col gap-3" role="radiogroup">
            {LANGS.map((l) => (
              <label key={l.code} className={cx("flex h-16 cursor-pointer items-center justify-between rounded-[18px] border-2 bg-surface px-5 transition-colors", lang === l.code ? "border-accent" : "border-transparent shadow-[var(--shadow)]")}>
                <input
                  type="radio"
                  name="language"
                  value={l.code}
                  checked={lang === l.code}
                  onChange={() => startLang(() => setLanguageAction(l.code))}
                  className="sr-only"
                />
                <span lang={l.code} dir={l.dir} className="text-[19px] font-medium text-ink">
                  {l.native}
                </span>
                <span className={cx("grid size-6 place-items-center rounded-full border-2", lang === l.code ? "border-accent bg-accent" : "border-line-strong")}>
                  {lang === l.code && <span className="size-2 rounded-full bg-white" />}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Step 2: about you */}
        <section hidden={step !== 1} className="rise-in">
          <h1 className="font-display text-[30px] leading-[1.2] text-ink">{t.aboutTitle}</h1>
          <p className="mt-2 text-[15.5px] text-ink-2">{t.aboutHint}</p>
          <div className="mt-7 flex flex-col gap-5">
            <Field label={t.fullName} htmlFor="fullName">
              <Input id="fullName" name="fullName" maxLength={100} autoComplete="name" />
            </Field>
            <div className="grid grid-cols-[1.4fr_1fr] gap-3">
              <Field label={t.dob} htmlFor="dob">
                <Input id="dob" name="dateOfBirth" type="date" dir="ltr" max={new Date().toISOString().slice(0, 10)} />
              </Field>
              <Field label={t.orAge} htmlFor="age">
                <Input id="age" name="ageYears" type="number" min={0} max={120} inputMode="numeric" dir="ltr" />
              </Field>
            </div>
            <Field label={`${t.sex} · ${common.optional}`} htmlFor="sex">
              <Select id="sex" name="sex" defaultValue="undisclosed">
                {(Object.keys(t.sexOptions) as (keyof typeof t.sexOptions)[]).map((k) => (
                  <option key={k} value={k}>
                    {t.sexOptions[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        {/* Step 3: place */}
        <section hidden={step !== 2} className="rise-in">
          <h1 className="font-display text-[30px] leading-[1.2] text-ink">{t.placeTitle}</h1>
          <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{t.placeHint}</p>
          <div className="mt-7 flex flex-col gap-5">
            <Field label={t.country} htmlFor="country">
              <Input id="country" name="country" defaultValue={defaultCountry(lang)} autoComplete="country-name" />
            </Field>
            <Field label={t.region} htmlFor="region">
              <Input id="region" name="region" autoComplete="address-level2" />
            </Field>
            <Field label={`${t.phone} · ${common.optional}`} htmlFor="phone">
              <Input id="phone" name="phone" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" />
            </Field>
          </div>
        </section>

        {/* Step 4: privacy */}
        <section hidden={step !== 3} className="rise-in">
          <span className="mb-5 grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
            <ShieldCheck className="size-7" aria-hidden />
          </span>
          <h1 className="font-display text-[30px] leading-[1.2] text-ink">{t.privacyTitle}</h1>
          <p className="mt-2 text-[15.5px] text-accent">{t.noCnic}</p>
          <label className="mt-7 flex cursor-pointer gap-4 rounded-[18px] bg-surface p-5 shadow-[var(--shadow)]">
            <input type="checkbox" name="aiConsent" defaultChecked className="mt-1 size-5 shrink-0 accent-[var(--accent)]" />
            <span className="text-[15.5px] leading-relaxed text-ink">{t.aiConsent}</span>
          </label>
        </section>
      </div>

      <div className="sticky bottom-0 mt-8 bg-bg pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        {(error || serverError) && (
          <p role="alert" className="mb-3 text-center text-[14.5px] text-urgent">
            {error ?? serverError}
          </p>
        )}
        {step < total - 1 ? (
          <Button type="button" block onClick={next}>
            {common.next}
          </Button>
        ) : (
          <Button type="submit" block disabled={pending}>
            {pending ? common.saving : t.finish}
          </Button>
        )}
      </div>
    </form>
  );
}

/* ───────── Profile editing (from the Profile tab) ───────── */

export function ProfileForm({ t, common, me, defaults }: { t: Dict["onboarding"]; common: Dict["common"]; me: Dict["me"]; defaults: ProfileDefaults }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="language" value={defaults.language} />
      <Field label={t.fullName} htmlFor="fullName">
        <Input id="fullName" name="fullName" required minLength={2} maxLength={100} defaultValue={defaults.fullName} autoComplete="name" />
      </Field>
      <div className="grid grid-cols-[1.4fr_1fr] gap-3">
        <Field label={t.dob} htmlFor="dob">
          <Input id="dob" name="dateOfBirth" type="date" dir="ltr" defaultValue={defaults.dateOfBirth ?? ""} max={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label={t.orAge} htmlFor="age">
          <Input id="age" name="ageYears" type="number" min={0} max={120} inputMode="numeric" dir="ltr" defaultValue={defaults.ageYears ?? ""} />
        </Field>
      </div>
      <Field label={`${t.sex} · ${common.optional}`} htmlFor="sex">
        <Select id="sex" name="sex" defaultValue={defaults.sex ?? "undisclosed"}>
          {(Object.keys(t.sexOptions) as (keyof typeof t.sexOptions)[]).map((k) => (
            <option key={k} value={k}>
              {t.sexOptions[k]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.country} htmlFor="country">
          <Input id="country" name="country" required defaultValue={defaults.country} />
        </Field>
        <Field label={t.region} htmlFor="region">
          <Input id="region" name="region" defaultValue={defaults.region ?? ""} />
        </Field>
      </div>
      <Field label={`${t.phone} · ${common.optional}`} htmlFor="phone">
        <Input id="phone" name="phone" type="tel" dir="ltr" defaultValue={defaults.phone ?? ""} />
      </Field>

      <div className="overflow-hidden rounded-[18px] bg-surface shadow-[var(--shadow)] divide-y divide-line">
        <label className="flex cursor-pointer gap-4 p-4">
          <input type="checkbox" name="aiConsent" defaultChecked={defaults.aiConsent} className="mt-1 size-5 shrink-0 accent-[var(--accent)]" />
          <span className="text-[15px] leading-relaxed text-ink">{t.aiConsent}</span>
        </label>
        <label className="flex cursor-pointer gap-4 p-4">
          <input type="checkbox" name="voiceNotifications" defaultChecked={defaults.voiceNotifications} className="mt-1 size-5 shrink-0 accent-[var(--accent)]" />
          <span>
            <span className="block text-[15.5px] font-medium text-ink">{me.voiceNotif}</span>
            <span className="text-[14px] leading-relaxed text-ink-3">{me.voiceNotifHint}</span>
          </span>
        </label>
      </div>

      {state?.ok && <p className="text-center text-[14.5px] text-within">{common.saved}</p>}
      {state?.error && <p className="text-center text-[14.5px] text-urgent">{common.error}</p>}
      <Button type="submit" block disabled={pending}>
        {pending ? common.saving : common.save}
      </Button>
    </form>
  );
}
