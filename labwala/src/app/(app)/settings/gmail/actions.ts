"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { disconnect, getSenders, resolvePending, setSenders } from "@/lib/gmail";

const email = z.string().trim().toLowerCase().email().max(200);

export async function addSenderAction(_: { error?: string } | undefined, form: FormData) {
  const user = await requireApiUser();
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "invalid" };
  setSenders(user.id, [...getSenders(user.id), parsed.data]);
  revalidatePath("/settings/gmail");
  return {};
}

export async function removeSenderAction(address: string) {
  const user = await requireApiUser();
  setSenders(user.id, getSenders(user.id).filter((s) => s !== address));
  revalidatePath("/settings/gmail");
}

export async function resolvePendingAction(id: string, accept: boolean) {
  const user = await requireApiUser();
  await resolvePending(user.id, id, accept);
  revalidatePath("/settings/gmail");
  revalidatePath("/home");
}

export async function disconnectGmailAction() {
  const user = await requireApiUser();
  await disconnect(user.id);
  revalidatePath("/settings/gmail");
}
