"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, FlaskConical, Plus, Trash2 } from "lucide-react";
import { confirmReportAction } from "@/app/actions";
import type { Dict } from "@/lib/i18n/dictionaries";
import { Sheet } from "@/components/sheet";
import { Button, Field, Input, cx } from "@/components/ui";

export type EditRow = {
  key: string;
  id: string | null;
  name: string; // shown in the list (localized when known)
  testName: string; // as printed, editable
  valueText: string;
  unit: string;
  refText: string;
  labFlag: string;
  reasons: string[]; // codes
};

type ConfirmT = Dict["confirm"];

export function ConfirmEditor({
  reportId,
  t,
  common,
  initial,
}: {
  reportId: string;
  t: ConfirmT;
  common: Dict["common"];
  initial: { labName: string; reportDate: string; dateLabel: string; rows: EditRow[]; patientAge: number | null; patientSex: "male" | "female" | null };
}) {
  const [labName, setLabName] = useState(initial.labName);
  const [reportDate, setReportDate] = useState(initial.reportDate);
  const [rows, setRows] = useState<EditRow[]>(initial.rows);
  const [age, setAge] = useState<string>(initial.patientAge === null ? "" : String(initial.patientAge));
  const [sex, setSex] = useState<"male" | "female" | null>(initial.patientSex);
  const [editing, setEditing] = useState<EditRow | null>(null);
  const [meta, setMeta] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  const check = rows.filter((r) => r.reasons.length);
  const ok = rows.filter((r) => !r.reasons.length);

  function saveRow(r: EditRow) {
    // An edited row has been checked by the user
    const next = { ...r, reasons: [], name: r.testName.trim() || r.name };
    setRows((rs) => (rs.some((x) => x.key === r.key) ? rs.map((x) => (x.key === r.key ? next : x)) : [...rs, next]));
    setEditing(null);
  }

  function submit() {
    setError(false);
    start(async () => {
      const res = await confirmReportAction(reportId, {
        labName: labName.trim() || null,
        reportDate: reportDate || null,
        patientAge: age.trim() && Number.isFinite(Number(age)) ? Math.max(0, Math.min(120, Math.round(Number(age)))) : null,
        patientSex: sex,
        rows: rows.map((r) => ({
          id: r.id,
          testName: r.testName.trim(),
          valueText: r.valueText.trim(),
          unit: r.unit.trim() || null,
          refText: r.refText.trim() || null,
          labFlag: r.labFlag.trim() || null,
        })),
      });
      if (res?.error) setError(true);
    });
  }

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-30 lg:top-16 -mx-4 flex h-14 items-center bg-bg/85 px-2 backdrop-blur-xl sm:-mx-6">
        <Link href="/home" aria-label={common.back} className="grid size-11 place-items-center rounded-full text-ink hover:bg-surface-2">
          <ChevronLeft className="size-6 rtl:-scale-x-100" aria-hidden />
        </Link>
      </header>

      <div className="mb-6 rise-in">
        <h1 className="font-display text-[30px] leading-[1.2] text-ink">{t.title}</h1>
        <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{t.subtitle}</p>
      </div>

      {/* Report details: one tap target */}
      <button onClick={() => setMeta(true)} className="mb-7 flex w-full items-center gap-3 rounded-[18px] bg-surface p-4 text-start shadow-[var(--shadow)] active:bg-surface-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-surface-2 text-ink-2">
          <FlaskConical className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block truncate text-start text-[16px] font-medium text-ink">{labName || t.notSet}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-ink-3">
            <CalendarDays className="size-3.5" aria-hidden />
            {reportDate ? initial.dateLabel && reportDate === initial.reportDate ? initial.dateLabel : reportDate : t.notSet}
          </span>
        </span>
        <ChevronRight className="size-5 text-ink-3/70 rtl:-scale-x-100" aria-hidden />
      </button>

      {/* Patient age/sex as printed. Missing → ask; never guessed from name or profile. */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-[14px] font-semibold text-ink-2">{t.demoTitle}</h2>
        <div className="rounded-[18px] bg-surface p-4 shadow-[var(--shadow)]">
          {(initial.patientAge === null || initial.patientSex === null) && (
            <p className="mb-4 rounded-[12px] bg-outside-soft p-3 text-[14px] leading-relaxed text-ink">{t.demoMissing}</p>
          )}
          <div className="grid grid-cols-[1fr_1.4fr] gap-3">
            <label className="flex flex-col gap-1.5 text-[14px] font-medium text-ink">
              {t.age}
              <Input type="number" inputMode="numeric" min={0} max={120} dir="ltr" value={age} onChange={(e) => setAge(e.target.value)} placeholder="—" />
            </label>
            <div className="flex flex-col gap-1.5 text-[14px] font-medium text-ink">
              {t.sex}
              <div role="radiogroup" aria-label={t.sex} className="grid h-[52px] grid-cols-2 rounded-[14px] bg-surface-2 p-1">
                {(["female", "male"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={sex === v}
                    onClick={() => setSex(sex === v ? null : v)}
                    className={cx("rounded-[11px] text-[15px] transition-all", sex === v ? "bg-surface font-semibold text-ink shadow-[var(--shadow)]" : "text-ink-2")}
                  >
                    {t.sexOptions[v]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {rows.length === 0 && <p className="mb-6 rounded-[16px] bg-outside-soft p-4 text-[15px] leading-relaxed text-ink">{t.nothingFound}</p>}

      {check.length > 0 && (
        <RowGroup title={`${t.checkGroup} · ${check.length}`} warn>
          {check.map((r) => (
            <RowButton key={r.key} r={r} t={t} onClick={() => setEditing(r)} />
          ))}
        </RowGroup>
      )}
      {ok.length > 0 && (
        <RowGroup title={`${t.okGroup} · ${ok.length}`}>
          {ok.map((r) => (
            <RowButton key={r.key} r={r} t={t} onClick={() => setEditing(r)} />
          ))}
        </RowGroup>
      )}

      <button
        onClick={() => setEditing({ key: crypto.randomUUID(), id: null, name: "", testName: "", valueText: "", unit: "", refText: "", labFlag: "", reasons: [] })}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-line-strong text-[15.5px] text-ink-2 active:bg-surface-2"
      >
        <Plus className="size-5" aria-hidden />
        {t.addRow}
      </button>

      {/* Primary action, thumb zone */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-bg/92 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl">
          {error && <p className="mb-2 text-center text-[14px] text-urgent">{common.error}</p>}
          <Button block onClick={submit} disabled={pending || rows.length === 0}>
            {pending ? common.saving : t.confirmAll}
          </Button>
        </div>
      </div>

      <EditSheet row={editing} t={t} common={common} onClose={() => setEditing(null)} onSave={saveRow} onRemove={(key) => {
        setRows((rs) => rs.filter((x) => x.key !== key));
        setEditing(null);
      }} />

      <Sheet
        open={meta}
        onClose={() => setMeta(false)}
        closeLabel={common.close}
        title={t.details}
        footer={
          <Button block onClick={() => setMeta(false)}>
            {common.done}
          </Button>
        }
      >
        <div className="flex flex-col gap-5 pt-2">
          <Field label={t.lab} htmlFor="lab">
            <Input id="lab" value={labName} onChange={(e) => setLabName(e.target.value)} />
          </Field>
          <Field label={t.date} htmlFor="date">
            <Input id="date" type="date" dir="ltr" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}

function RowGroup({ title, warn, children }: { title: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className={cx("mb-2 flex items-center gap-2 px-1 text-[14px] font-semibold", warn ? "text-outside" : "text-ink-2")}>
        {warn && <AlertTriangle className="size-4" aria-hidden />}
        {title}
      </h2>
      <ul className="overflow-hidden rounded-[18px] bg-surface shadow-[var(--shadow)] divide-y divide-line">{children}</ul>
    </section>
  );
}

function RowButton({ r, t, onClick }: { r: EditRow; t: ConfirmT; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-start active:bg-surface-2">
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block truncate text-start text-[16px] font-medium text-ink">{r.name || r.testName}</span>
          <span className="mt-0.5 block truncate text-[13.5px] text-ink-3">
            {r.reasons.length ? (
              <span className="text-outside">{r.reasons.map((c) => t.reasons[c as keyof ConfirmT["reasons"]]).filter(Boolean).join(" · ")}</span>
            ) : (
              <>
                {t.range}: <span className="ltr-num">{r.refText || "—"}</span>
              </>
            )}
          </span>
        </span>
        <span className="ltr-num shrink-0 text-[17px] font-semibold text-ink" dir="ltr">
          {r.valueText} <span className="text-[12.5px] font-normal text-ink-3">{r.unit}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-ink-3/70 rtl:-scale-x-100" aria-hidden />
      </button>
    </li>
  );
}

function EditSheet({ row, t, common, onClose, onSave, onRemove }: { row: EditRow | null; t: ConfirmT; common: Dict["common"]; onClose: () => void; onSave: (r: EditRow) => void; onRemove: (key: string) => void }) {
  return (
    <Sheet open={!!row} onClose={onClose} closeLabel={common.close} title={t.editTitle}>
      {row && <EditForm key={row.key} row={row} t={t} common={common} onSave={onSave} onRemove={onRemove} />}
    </Sheet>
  );
}

function EditForm({ row, t, common, onSave, onRemove }: { row: EditRow; t: ConfirmT; common: Dict["common"]; onSave: (r: EditRow) => void; onRemove: (key: string) => void }) {
  const [r, setR] = useState(row);
  const valid = r.testName.trim() && r.valueText.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(r);
      }}
      className="flex flex-col gap-5 pt-2"
    >
      <Field label={t.test} htmlFor="e-name">
        <Input id="e-name" dir="ltr" value={r.testName} onChange={(e) => setR({ ...r, testName: e.target.value })} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.value} htmlFor="e-value">
          <Input id="e-value" dir="ltr" inputMode="decimal" className="text-[18px] font-semibold" value={r.valueText} onChange={(e) => setR({ ...r, valueText: e.target.value })} required />
        </Field>
        <Field label={t.unit} htmlFor="e-unit">
          <Input id="e-unit" dir="ltr" value={r.unit} onChange={(e) => setR({ ...r, unit: e.target.value })} />
        </Field>
      </div>
      <Field label={t.range} htmlFor="e-range">
        <Input id="e-range" dir="ltr" placeholder={t.rangePlaceholder} value={r.refText} onChange={(e) => setR({ ...r, refText: e.target.value })} />
      </Field>
      <Field label={t.flag} htmlFor="e-flag">
        <Input id="e-flag" dir="ltr" maxLength={12} value={r.labFlag} onChange={(e) => setR({ ...r, labFlag: e.target.value })} />
      </Field>
      <Button type="submit" block disabled={!valid}>
        {common.save}
      </Button>
      {row.testName && (
        <button type="button" onClick={() => onRemove(row.key)} className="flex h-12 items-center justify-center gap-2 rounded-[14px] text-[15px] text-urgent active:bg-urgent-soft">
          <Trash2 className="size-4" aria-hidden />
          {t.remove}
        </button>
      )}
    </form>
  );
}
