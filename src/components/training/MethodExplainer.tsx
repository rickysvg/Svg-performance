import { RIR_PLAIN } from "@/lib/rir";

const LINES = [
  ["Alactic", "A few seconds all-out, then enough rest that the next effort is still fast. Wednesday bike."],
  ["Lactic", "Hard work with short rest. It burns. We use it sparingly, and not in the last week before a fight."],
  ["Aerobic", "Steady work you could talk through. Sunday bike."],
  ["Contrast", "A heavy lift, then an explosive jump. Intermediate and advanced."],
  ["French contrast", "Heavy lift, a loaded jump, then a bodyweight jump. Advanced, and only off-season."],
] as const;

/** Short definitions for the words on the plan. Closed until the athlete asks. */
export function MethodExplainer() {
  return (
    <details data-method-explainer className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-accent">
        Alactic, lactic, aerobic, contrast, RIR
      </summary>
      <dl className="mt-2 space-y-2 text-sm leading-snug text-muted">
        {LINES.map(([term, line]) => (
          <div key={term}>
            <dt className="font-semibold">{term}</dt>
            <dd>{line}</dd>
          </div>
        ))}
        <div>
          <dt className="font-semibold">RIR</dt>
          <dd>{RIR_PLAIN}</dd>
        </div>
      </dl>
    </details>
  );
}
