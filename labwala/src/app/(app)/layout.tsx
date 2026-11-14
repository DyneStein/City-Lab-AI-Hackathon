import { requireUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { Logo } from "@/components/logo";
import { TabBar, TopNav } from "./tab-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const { t } = await getDict();
  return (
    <div className="min-h-dvh">
      <TopNav t={t.tabs} nav={t.common.mainNav} appName={<Logo label={t.appName} />} phoneLabel={t.handoff.openOnPhone} />
      <main className="mx-auto w-full max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+112px)] pt-2 sm:px-6 lg:pb-16 lg:pt-6">{children}</main>
      <TabBar t={t.tabs} nav={t.common.mainNav} />
    </div>
  );
}
