import { RIR_PLAIN } from "@/lib/rir";

/** Compact help beside the first RIR lift. Closed until the athlete asks. */
export function RirHint() {
  return (
    <details data-rir-hint className="mt-1">
      <summary className="cursor-pointer text-xs font-semibold text-accent">How heavy?</summary>
      <p className="mt-1 text-sm leading-snug text-muted">{RIR_PLAIN}</p>
    </details>
  );
}
