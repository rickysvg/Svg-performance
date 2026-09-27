import type { MobilityCredit } from "@/lib/mobility";
import { MOBILITY_DISCLAIMER } from "@/lib/mobility";

export function CreditList({ credits }: { credits: MobilityCredit[] }) {
  if (credits.length === 0) return null;
  return (
    <div className="space-y-2 text-sm text-muted">
      <ul className="space-y-1">
        {credits.map((credit) => (
          <li key={credit.url}>
            Inspired by {credit.coach} — {credit.idea}.{" "}
            <a href={credit.url} className="text-accent underline" target="_blank" rel="noreferrer">
              Watch their original
            </a>
            .
          </li>
        ))}
      </ul>
      <p className="text-xs">{MOBILITY_DISCLAIMER}</p>
    </div>
  );
}
