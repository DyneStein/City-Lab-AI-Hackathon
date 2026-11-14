import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { AuthForm } from "../auth-form";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/home");
  const { t } = await getDict();
  return (
    <>
      <h1 className="font-display text-[36px] leading-tight text-ink">{t.auth.signInTitle}</h1>
      <p className="mt-2 mb-8 text-ink-2">{t.tagline}</p>
      <AuthForm mode="login" t={t.auth} />
    </>
  );
}
