import { BAG_THEME_CREDIT, bagFocusLines } from "@/lib/bag-themes";

export function BagFocusList({ notes }: { notes?: string | null }) {
  const parsed = notes ? bagFocusLines(notes) : null;
  if (!parsed) return null;
  return (
    <div className="mt-2" data-bag-focus>
      <p className="font-display text-[11px] uppercase tracking-wide text-accent">Focus rounds</p>
      <ol className="mt-1 space-y-1 text-sm leading-snug">
        {parsed.rounds.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      {parsed.credit ? (
        <p className="mt-2 text-[11px] leading-snug text-muted">{BAG_THEME_CREDIT}</p>
      ) : null}
    </div>
  );
}
