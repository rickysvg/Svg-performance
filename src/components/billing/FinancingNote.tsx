import { BNPL_COPY, financingStatusCopy } from "@/lib/bnpl";

export function FinancingNote({
  configured,
  className = "",
}: {
  configured: boolean;
  className?: string;
}) {
  return (
    <aside
      className={`rounded-xl border border-line bg-card p-4 text-sm ${className}`.trim()}
      data-testid="financing-note"
    >
      <p className="font-semibold text-foreground">{BNPL_COPY.whenAvailable}</p>
      <p className="mt-2 text-muted">{financingStatusCopy(configured)}</p>
    </aside>
  );
}
