import { RIR_PLAIN } from "@/lib/rir";

/** Train help. Starts open so a new athlete reads RIR, and the summary stays after they collapse it. */
export function RirExplainer() {
  return (
    <details open data-rir-explainer className="rounded-2xl border border-line bg-card px-4 py-3">
      <summary className="font-display cursor-pointer text-xs uppercase tracking-wide text-accent">
        How heavy — RIR
      </summary>
      <p className="mt-2 text-sm leading-snug">{RIR_PLAIN}</p>
    </details>
  );
}
