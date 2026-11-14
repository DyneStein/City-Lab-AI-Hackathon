import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";
import { getDict, getLang } from "@/lib/i18n/server";
import { dictionaries, langMeta } from "@/lib/i18n/dictionaries";
import { DesktopHandoff } from "@/components/desktop-handoff";

const ui = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", display: "swap", style: ["normal", "italic"] });
const nastaliq = Noto_Nastaliq_Urdu({ subsets: ["arabic"], variable: "--font-nastaliq", weight: ["400", "600", "700"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.appName} · ${t.tagline}`, description: t.landing.lead };
}

export const viewport: Viewport = { themeColor: "#f6f4ef", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const meta = langMeta(lang);
  return (
    <html lang={lang} dir={meta.dir} className={`${ui.variable} ${serif.variable} ${nastaliq.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <DesktopHandoff t={dictionaries[lang].handoff} appName={dictionaries[lang].appName} />
      </body>
    </html>
  );
}
