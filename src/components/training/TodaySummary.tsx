/**
 * Today's plan, as text. Not a button: it does not start a session or a timer.
 */
export function TodaySummary({
  modality,
  note,
  minutes,
}: {
  modality: string;
  note: string;
  minutes: number;
}) {
  const title = modality.trim() || "Session";
  const body = note.trim();
  return (
    <section
      data-today-summary
      aria-label="Today's session"
      className="hc-carbon relative rounded-[1.75rem] px-5 py-5 text-white"
    >
      <p className="font-display text-xs uppercase tracking-[0.16em] text-[#CBF805]">Today</p>
      <h2 className="mt-3 text-2xl text-white">{title}</h2>
      {body ? <p className="mt-3 text-base normal-case leading-relaxed text-white/85">{body}</p> : null}
      {minutes > 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-[#CBF805]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="13" r="7" />
            <path d="M12 13V9" strokeLinecap="round" />
            <path d="M9 3.5h6" strokeLinecap="round" />
            <path d="M12 3.5V5" strokeLinecap="round" />
          </svg>
          <span>~{minutes} min</span>
        </p>
      ) : null}
    </section>
  );
}
