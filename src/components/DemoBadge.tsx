export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-accent bg-accent px-2.5 py-1 text-xs font-bold tracking-wide text-black ${className}`}
    >
      DEMO
    </span>
  );
}
