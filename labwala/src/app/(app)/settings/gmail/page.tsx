import { Mail, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { fmt, formatDate } from "@/lib/i18n/dictionaries";
import { getConnection, gmailConfigured, listPending } from "@/lib/gmail";
import { AppBar, ButtonLink, Card, Notice } from "@/components/ui";
import { GmailPanel } from "./gmail-panel";

export default async function GmailPage({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const user = await requireUser();
  const { t, lang } = await getDict();
  const g = t.gmail;
  const { e, ok } = await searchParams;
  const conn = getConnection(user.id);
  const errorText = e === "config" ? null : e ? (g.errors[e as keyof typeof g.errors] ?? g.errors.failed) : null;
  const time = (ms: number) => `${formatDate(ms, lang)} ${new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ur-PK", { hour: "numeric", minute: "2-digit" }).format(ms)}`;

  return (
    <>
      <AppBar backHref="/settings" backLabel={t.common.back} title={g.title} />
      <div className="flex flex-col gap-6 pt-2">
        <Card className="flex gap-4 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Mail className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[15.5px] leading-relaxed text-ink">{g.intro}</p>
            <p className="mt-2 flex gap-1.5 text-[13.5px] leading-relaxed text-ink-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              {g.privacy}
            </p>
          </div>
        </Card>

        {ok && <Notice>{g.connected}</Notice>}
        {errorText && <Notice tone="warn">{errorText}</Notice>}

        {!gmailConfigured() ? (
          <Card className="p-5">
            <p className="font-medium text-ink">{g.notConfiguredTitle}</p>
            <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{g.notConfiguredBody}</p>
          </Card>
        ) : !conn ? (
          <ButtonLink href="/api/gmail/connect" block prefetch={false}>
            <Mail className="size-5" aria-hidden />
            {g.connect}
          </ButtonLink>
        ) : (
          <>
            <p className="px-1 text-[15px] text-ink-2">{fmt(g.connectedAs, { email: "" })}<span className="ltr-num font-medium text-ink" dir="ltr">{conn.emailAddress}</span></p>
            <GmailPanel
              t={g}
              senders={JSON.parse(conn.senders)}
              lastChecked={conn.lastSyncAt ? time(conn.lastSyncAt) : null}
              pending={listPending(user.id).map((p) => ({ id: p.id, filename: p.filename, sender: p.sender, when: formatDate(p.receivedAt, lang) }))}
            />
          </>
        )}
      </div>
    </>
  );
}
