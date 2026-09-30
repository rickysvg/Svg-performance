import { RIR_PLAIN } from "@/lib/rir";

/** One line next to a lift prescription so the RIR number has a meaning. */
export function RirHint() {
  return (
    <p data-rir-hint className="text-sm leading-snug text-muted">
      {RIR_PLAIN}
    </p>
  );
}
