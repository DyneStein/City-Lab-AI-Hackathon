import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { OnboardingFlow } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser({ onboarded: false });
  if (user.profile?.onboardedAt) redirect("/home");
  const { t, lang } = await getDict();
  return (
    <main className="mx-auto max-w-md px-5 pt-6">
      <OnboardingFlow t={t.onboarding} common={t.common} lang={lang} />
    </main>
  );
}
