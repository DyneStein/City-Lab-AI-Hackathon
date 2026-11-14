"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, type FormState } from "@/app/actions";
import type { Dict } from "@/lib/i18n/dictionaries";
import { Button, Field, Input, Notice } from "@/components/ui";

export function AuthForm({ mode, t }: { mode: "login" | "register"; t: Dict["auth"] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? loginAction : registerAction, undefined);
  const err = state?.error;
  const message = err === "exists" ? t.exists : err === "tooMany" ? t.tooMany : err === "terms" ? t.termsRequired : err ? t.invalid : null;

  return (
    <form action={action} className="flex flex-col gap-5">
      {message && <Notice tone="warn">{message}</Notice>}
      <Field label={t.email} htmlFor="email">
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required dir="ltr" />
      </Field>
      <Field label={t.password} htmlFor="password" hint={mode === "register" ? t.passwordHint : undefined}>
        <Input id="password" name="password" type="password" minLength={10} autoComplete={mode === "login" ? "current-password" : "new-password"} required dir="ltr" />
      </Field>
      {mode === "register" && (
        <label className="flex cursor-pointer gap-3 rounded-[16px] bg-surface p-4 text-[14.5px] leading-relaxed text-ink-2 shadow-[var(--shadow)]">
          <input type="checkbox" name="terms" required className="mt-1 size-5 shrink-0 accent-[var(--accent)]" />
          <span>{t.termsConsent}</span>
        </label>
      )}
      <Button type="submit" block disabled={pending} className="mt-2">
        {mode === "login" ? t.signIn : t.signUp}
      </Button>
      <p className="text-center text-[15px] text-ink-2">
        {mode === "login" ? t.noAccount : t.haveAccount}{" "}
        <Link className="font-medium text-accent underline-offset-4 hover:underline" href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? t.signUp : t.signIn}
        </Link>
      </p>
    </form>
  );
}
