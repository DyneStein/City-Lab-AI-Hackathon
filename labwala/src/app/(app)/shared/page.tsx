import { Share2 } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export default async function SharedPage() {
  const { t } = await getDict();
  return <PhasePlaceholder t={t} backHref="/settings" title={t.me.shared} body={t.placeholders.shared} phase={8} icon={<Share2 className="size-7" />} />;
}
