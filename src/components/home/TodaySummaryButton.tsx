import Link from "next/link";
import { coachVoiceEnabled } from "@/lib/coach/config";

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="block">
      <path d="M5 3.2v9.6L13 8 5 3.2Z" fill="currentColor" />
    </svg>
  );
}

export function TodaySummaryButton({
  name,
  circle,
}: {
  name: string;
  circle: string;
  coachId: string;
}) {
  return (
    <Link
      href="/home/summary"
      data-today-summary
      aria-label={`Open Coach ${name} today's summary`}
      className="hc-panel flex h-14 w-full items-center gap-2.5 px-2.5 text-left"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={circle}
        alt=""
        width={512}
        height={512}
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-accent"
      />
      <span className="min-w-0 flex-1 whitespace-nowrap text-xs font-semibold leading-none tracking-tighter">
        Coach {name} – Today&apos;s Summary
      </span>
      {coachVoiceEnabled() ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground">
          <PlayIcon />
        </span>
      ) : null}
    </Link>
  );
}
