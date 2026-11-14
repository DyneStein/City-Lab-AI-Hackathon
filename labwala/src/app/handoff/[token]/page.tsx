import { redirect } from "next/navigation";
import { Smartphone } from "lucide-react";
import { createSession } from "@/lib/auth/session";
import { claimHandoffToken } from "@/lib/handoff";
import { getDict } from "@/lib/i18n/server";
import { dictionaries, langMeta, type Lang } from "@/lib/i18n/dictionaries";
import { Button, ButtonLink } from "@/components/ui";
import { Logo } from "@/components/logo";

/**
 * Phone side of the QR handoff. Opening the link does nothing by itself (link previews
 * and scanners cannot consume it); the explicit tap claims the token atomically.
 */
export default async function HandoffPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string; l?: string }> }) {
  const { token } = await params;
  const { e, l } = await searchParams;
  const fromLink = (["en", "ur", "pa"] as const).find((x) => x === l) as Lang | undefined;
  const current = fromLink ? { t: dictionaries[fromLink], lang: fromLink } : await getDict();
  const t = current.t;
  const keep = fromLink ? `&l=${fromLink}` : "";

  async function claim() {
    "use server";
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) redirect(`/handoff/${encodeURIComponent(token)}?e=1${keep}`);
    const userId = claimHandoffToken(token);
    if (!userId) redirect(`/handoff/${token}?e=1${keep}`);
    await createSession(userId);
    redirect("/home");
  }

  return (
    <main lang={current.lang} dir={langMeta(current.lang).dir} className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-6">
      <Logo label={t.appName} />
      <div className="flex flex-1 flex-col items-center justify-center text-center rise-in">
        <span className="mb-6 grid size-20 place-items-center rounded-full bg-accent-soft text-accent">
          <Smartphone className="size-9" aria-hidden />
        </span>
        <h1 className="font-display text-[30px] leading-[1.2] text-ink">{t.handoff.claimTitle}</h1>
        <p className="mt-3 max-w-[34ch] text-[16px] leading-relaxed text-ink-2">{e ? t.handoff.expired : t.handoff.claimBody}</p>
      </div>
      {e ? (
        <ButtonLink href="/login" block variant="secondary">
          {t.auth.signIn}
        </ButtonLink>
      ) : (
        <form action={claim}>
          <Button block>{t.handoff.claimCta}</Button>
        </form>
      )}
    </main>
  );
}
