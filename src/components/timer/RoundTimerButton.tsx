"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BikeClockScreen } from "@/components/timer/BikeClockScreen";
import { RoundTimer, type RoundTimerLaunch } from "@/components/timer/RoundTimer";
import type { BikeSession } from "@/lib/bike-sessions";
import type { TimerMode } from "@/lib/round-timer";

function StopwatchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden className="block">
      <circle cx="12" cy="14" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 14V10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.25 3.25h5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3.25V5.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.9 6.1 18.2 4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function RoundTimerSheet({
  launch,
  mode,
  bikeSession,
  bikeToken,
  bikeDayId,
  titleId,
  onClose,
}: {
  launch: RoundTimerLaunch | null;
  mode: TimerMode | null;
  bikeSession: BikeSession | null;
  bikeToken: string | null;
  bikeDayId: string | null;
  titleId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const sheet = (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-black/70"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-round-timer-sheet
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-background px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2"
      >
        {bikeSession || bikeToken ? (
          <BikeClockScreen
            token={bikeToken}
            session={bikeSession}
            dayId={bikeDayId}
            onClose={onClose}
            titleId={titleId}
          />
        ) : (
          <RoundTimer launch={launch} onClose={onClose} titleId={titleId} mode={mode} />
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}

export function RoundTimerButton({
  launch = null,
  label,
  className,
  mode = null,
  bikeSession = null,
  bikeToken = null,
  bikeDayId = null,
}: {
  launch?: RoundTimerLaunch | null;
  label?: string;
  className?: string;
  mode?: TimerMode | null;
  bikeSession?: BikeSession | null;
  bikeToken?: string | null;
  bikeDayId?: string | null;
}) {
  const [sheet, setSheet] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const named = Boolean(label);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-round-timer-button
        aria-label={named ? undefined : "Start rounds"}
        aria-haspopup="dialog"
        aria-expanded={sheet}
        onClick={() => setSheet(true)}
        className={
          className ??
          (named
            ? "touch-target inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent font-display text-sm uppercase tracking-wide text-black"
            : "touch-target inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-black")
        }
      >
        <StopwatchIcon />
        {label ? <span>{label}</span> : null}
      </button>
      {sheet ? (
        <RoundTimerSheet
          launch={launch ?? null}
          mode={mode}
          bikeSession={bikeSession}
          bikeToken={bikeToken}
          bikeDayId={bikeDayId}
          titleId={titleId}
          onClose={() => {
            setSheet(false);
            buttonRef.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
