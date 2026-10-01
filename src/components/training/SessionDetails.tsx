export function SessionDetails({ children }: { children: React.ReactNode }) {
  return (
    <details data-session-details className="rounded-2xl border border-line bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-display text-base uppercase tracking-wide">Session details</span>
        <span className="text-xs text-muted">Warm-up, zones, gear</span>
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-4">{children}</div>
    </details>
  );
}
