import "server-only";
import { cookies } from "next/headers";
import { dictionaries, type Lang } from "./dictionaries";
import { getSessionUser } from "@/lib/auth/session";

export const LANG_COOKIE = "nuskha_lang";

/** Signed-in users: profile language. Visitors: cookie, defaulting to English. */
export async function getLang(): Promise<Lang> {
  const user = await getSessionUser();
  if (user?.profile?.language) return user.profile.language;
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  return c === "ur" || c === "pa" || c === "en" ? c : "en";
}

export async function getDict() {
  const lang = await getLang();
  return { lang, t: dictionaries[lang] };
}
