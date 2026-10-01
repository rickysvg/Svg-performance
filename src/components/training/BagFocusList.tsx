import { BAG_THEME_CREDIT, bagFocusLines } from "@/lib/bag-themes";

export function BagFocusList({
  notes,
  activeRound,
}: {
  notes?: string | null;
  /** While logging, show only this round’s cue. Omit to keep the full list collapsed. */
  activeRound?: number | null;
}) {
  const parsed = notes ? bagFocusLines(notes) : null;
  if (!parsed) return null;

  if (activeRound != null && activeRound > 0) {
    const index = Math.min(activeRound, parsed.rounds.length) - 1;
    const line = parsed.rounds[index];
    if (!line) return null;
    return (
      <p data-bag-focus data-bag-focus-current className="mt-2 text-sm leading-snug">
        <span className="font-display text-[11px] uppercase tracking-wide text-accent">
          This round
        </span>
        <span className="mt-0.5 block">{line}</span>
      </p>
    );
  }

  return (
    <details data-bag-focus className="mt-2">
      <summary className="cursor-pointer font-display text-[11px] uppercase tracking-wide text-accent">
        Focus rounds
      </summary>
      <ol className="mt-1 space-y-1 text-sm leading-snug">
        {parsed.rounds.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      {parsed.credit ? (
        <p className="mt-2 text-[11px] leading-snug text-muted">{BAG_THEME_CREDIT}</p>
      ) : null}
    </details>
  );
}
