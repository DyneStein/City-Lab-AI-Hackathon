import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { db, schema } from "@/lib/db";
import { AppBar } from "@/components/ui";
import { ProfileForm } from "@/app/onboarding/onboarding-form";

export default async function EditProfilePage() {
  const user = await requireUser();
  const { t } = await getDict();
  const p = user.profile!;
  const consent = db
    .select()
    .from(schema.consents)
    .where(and(eq(schema.consents.userId, user.id), eq(schema.consents.kind, "ai_processing")))
    .orderBy(desc(schema.consents.createdAt))
    .get();
  return (
    <>
      <AppBar backHref="/settings" backLabel={t.common.back} title={t.me.editProfile} />
      <div className="pt-2">
        <ProfileForm
          t={t.onboarding}
          common={t.common}
          me={t.me}
          defaults={{
            fullName: p.fullName,
            dateOfBirth: p.dateOfBirth,
            ageYears: p.ageYears,
            language: p.language,
            country: p.country,
            region: p.region,
            sex: p.sex,
            phone: p.phone,
            aiConsent: consent?.granted ?? false,
            voiceNotifications: p.voiceNotifications,
          }}
        />
      </div>
    </>
  );
}
