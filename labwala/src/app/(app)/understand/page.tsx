import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { listReports } from "@/lib/reports/service";

export default async function UnderstandPage() {
  const user = await requireUser();
  const reports = listReports(user.id);
  const latest = reports.find((r) => r.status === "confirmed") ?? reports[0];
  if (!latest) redirect("/scan");
  redirect(latest.status === "confirmed" ? `/reports/${latest.id}` : `/reports/${latest.id}/confirm`);
}
