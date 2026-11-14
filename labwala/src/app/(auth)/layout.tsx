import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { LangSwitcher } from "@/components/lang-switcher";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, lang } = await getDict();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5">
      <header className="flex h-16 items-center justify-between">
        <Link href="/" aria-label={t.common.back} className="-ms-2 grid size-11 place-items-center rounded-full text-ink hover:bg-surface-2">
          <ChevronLeft className="size-6 rtl:-scale-x-100" aria-hidden />
        </Link>
        <LangSwitcher current={lang} label={t.common.language} />
      </header>
      <main className="flex-1 pb-10 pt-6 rise-in">{children}</main>
    </div>
  );
}
