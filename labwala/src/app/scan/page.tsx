import { requireUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { Scanner } from "./scanner";

export default async function ScanPage() {
  await requireUser();
  const { t } = await getDict();
  return <Scanner t={t.scan} closeLabel={t.common.close} maxMb={env.MAX_UPLOAD_MB} />;
}
