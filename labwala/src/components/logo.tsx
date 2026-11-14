/** Wordmark: a simple test tube. No robot or generic AI imagery. */
export function Logo({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <rect width="28" height="28" rx="8.5" fill="var(--accent)" />
        <path d="M11 6.5h6M12.2 6.5v11.3a1.8 1.8 0 0 0 3.6 0V6.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M12.2 13.5h3.6v4.3a1.8 1.8 0 0 1-3.6 0Z" fill="#fff" />
      </svg>
      <span className="font-display text-[21px] tracking-[-0.01em] text-ink">{label}</span>
    </span>
  );
}
