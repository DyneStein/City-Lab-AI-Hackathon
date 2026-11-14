"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAccountAction, type FormState } from "@/app/actions";
import type { Dict } from "@/lib/i18n/dictionaries";
import { Sheet } from "@/components/sheet";
import { Button, Field, Input } from "@/components/ui";

/** Destructive action: separated, confirmed by typing, never one tap. */
export function DeleteAccount({ t, common }: { t: Dict["me"]; common: Dict["common"] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccountAction, undefined);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-start active:bg-surface-2">
        <span className="grid size-9 place-items-center rounded-[10px] bg-urgent-soft text-urgent">
          <Trash2 className="size-5" aria-hidden />
        </span>
        <span className="text-[16px] text-urgent">{t.deleteAccount}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} closeLabel={common.close} title={t.deleteAccount}>
        <form action={action} className="flex flex-col gap-5 pt-1">
          <p className="text-[15.5px] leading-relaxed text-ink-2">{t.deleteWarning}</p>
          <Field label={t.deleteConfirm} htmlFor="confirm-delete" error={state?.error === "confirm" ? t.deleteConfirm : undefined}>
            <Input id="confirm-delete" name="confirm" autoComplete="off" dir="ltr" />
          </Field>
          <Button variant="danger" block disabled={pending}>
            {t.deleteAccount}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
