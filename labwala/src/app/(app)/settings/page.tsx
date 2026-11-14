import { Bot, Download, LogOut, Mail, Share2, ShieldCheck, Stethoscope, Users, Volume2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { aiConfigured } from "@/lib/env";
import { privacyStatus } from "@/lib/privacy/pii";
import { logoutAction } from "@/app/actions";
import { Group, LargeTitle, Row } from "@/components/ui";
import { LangSwitcher } from "@/components/lang-switcher";
import { DeleteAccount } from "./delete-account";
import { getConnection } from "@/lib/gmail";

export default async function ProfilePage() {
  const user = await requireUser();
  const { t, lang } = await getDict();
  const p = user.profile!;
  const privacy = await privacyStatus();
  const initials = p.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <>
      <LargeTitle title={t.me.title} />

      <Group>
        <Row
          href="/settings/profile"
          icon={<span className="text-[15px] font-semibold uppercase">{initials}</span>}
          title={p.fullName}
          subtitle={[p.region, p.country].filter(Boolean).join("، ")}
        />
      </Group>

      <section className="mb-7">
        <h2 className="mb-2 px-1 text-[14px] font-semibold text-ink-2">{t.me.language}</h2>
        <LangSwitcher current={lang} label={t.me.language} block />
      </section>

      <Group title={t.me.care}>
        <Row href="/family" icon={<Users className="size-5" />} title={t.me.family} trailing={t.common.comingSoon} />
        <Row href="/doctors" icon={<Stethoscope className="size-5" />} title={t.me.doctors} trailing={t.common.comingSoon} />
        <Row href="/shared" icon={<Share2 className="size-5" />} title={t.me.shared} trailing={t.common.comingSoon} />
      </Group>

      <Group title={t.me.connections}>
        <Row href="/settings/gmail" icon={<Mail className="size-5" />} title={t.me.gmail} trailing={<span className="ltr-num" dir="ltr">{getConnection(user.id)?.emailAddress ?? ""}</span>} subtitle={getConnection(user.id) ? undefined : t.me.gmailStatus} />
        <Row icon={<Bot className="size-5" />} title={t.me.ai} trailing={aiConfigured() ? t.me.aiOn : t.me.aiOff} />
        <Row
          icon={<ShieldCheck className="size-5" />}
          title={t.me.privacyFilter}
          trailing={privacy === "presidio" ? t.me.privacyOn : privacy === "builtin" ? t.me.privacyBasic : t.me.privacyBlocked}
        />
        <Row icon={<Volume2 className="size-5" />} title={t.me.voice} subtitle={t.me.voiceOn} />
      </Group>

      <Group title={t.me.privacy}>
        <a href="/api/me/export" className="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-surface-2">
          <span className="grid size-9 place-items-center rounded-[10px] bg-surface-2 text-ink-2">
            <Download className="size-5" aria-hidden />
          </span>
          <span className="text-[16px] text-ink">{t.me.exportData}</span>
        </a>
        <DeleteAccount t={t.me} common={t.common} />
      </Group>

      <form action={logoutAction}>
        <button className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-surface text-[16px] font-medium text-ink shadow-[var(--shadow)] active:bg-surface-2">
          <LogOut className="size-5 text-ink-3 rtl:-scale-x-100" aria-hidden />
          {t.me.signOut}
        </button>
      </form>
    </>
  );
}
