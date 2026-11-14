import { Stethoscope } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export default async function DoctorsPage() {
  const { t } = await getDict();
  return <PhasePlaceholder t={t} backHref="/settings" title={t.me.doctors} body={t.placeholders.doctors} phase={7} icon={<Stethoscope className="size-7" />} />;
}
