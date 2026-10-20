import type { DeskTone } from "@/lib/admin-desk-status";

export function DeskCheck({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DeskBadge({ tone, label }: { tone: DeskTone; label: string }) {
  if (tone === "attention") {
    return (
      <span className="shrink-0 rounded-full bg-[#FF3B3B] px-2 py-1 font-telemetry text-[10px] uppercase tracking-wide text-white">
        {label}
      </span>
    );
  }
  if (tone === "clear") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 font-telemetry text-[10px] uppercase tracking-wide text-[#CBF805]">
        <DeskCheck />
        {label}
      </span>
    );
  }
  return (
    <span className="shrink-0 font-telemetry text-[10px] uppercase tracking-wide text-white/50">{label}</span>
  );
}
