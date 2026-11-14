import { Users } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export default async function FamilyPage() {
  const { t } = await getDict();
  return <PhasePlaceholder t={t} title={t.me.family} body={t.placeholders.family} phase={6} icon={<Users className="size-7" />} />;
}
