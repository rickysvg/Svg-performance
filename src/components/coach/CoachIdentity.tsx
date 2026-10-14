import type { Coach } from "@/lib/coaches";

export function CoachIdentity({
  coach,
  styleLabel,
}: {
  coach: Coach;
  styleLabel: string;
}) {
  return (
    <div data-coach-header className="flex items-center gap-3">
      <img
        src={coach.src}
        alt=""
        width={56}
        height={56}
        className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-accent"
      />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted">SVG Coach</p>
        <h1 className="text-2xl">{coach.name}</h1>
        <p className="text-sm text-muted">
          {coach.vibe} {styleLabel} style.
        </p>
      </div>
    </div>
  );
}
