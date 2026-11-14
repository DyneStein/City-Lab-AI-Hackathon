import Link from "next/link";
import { getDict } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getDict();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-[40px] text-ink">404</p>
      <p className="mt-2 text-[16px] text-ink-2">{t.common.notFound}</p>
      <Link href="/home" className="mt-6 inline-flex h-12 items-center rounded-[14px] bg-accent px-6 text-[16px] font-medium text-white">
        {t.common.goHome}
      </Link>
    </main>
  );
}
