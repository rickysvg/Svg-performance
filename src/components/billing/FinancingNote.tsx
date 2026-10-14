import { BNPL_COPY, financingStatusCopy } from "@/lib/bnpl";
import type { StripeKeyMode } from "@/lib/stripe";

export function FinancingNote({
  configured,
  mode = "test",
  className = "",
}: {
  configured: boolean;
  mode?: StripeKeyMode;
  className?: string;
}) {
  return (
    <aside
      className={`rounded-xl border border-line bg-card p-4 text-sm ${className}`.trim()}
      data-testid="financing-note"
    >
      <p className="font-semibold text-foreground">{BNPL_COPY.whenAvailable}</p>
      <p className="mt-2 text-muted">{financingStatusCopy(configured, mode)}</p>
    </aside>
  );
}
