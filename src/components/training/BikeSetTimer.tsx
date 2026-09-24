"use client";

import { useEffect, useRef, useState } from "react";
import {
  bikeIntervalChrome,
  isLongBikeClock,
  type BikeSession,
} from "@/lib/bike-sessions";
import {
  idleBikeInterval,
  pauseBikeInterval,
  resumeBikeInterval,
  startBikeInterval,
  stopBikeInterval,
  tickBikeInterval,
  type BikeIntervalPhase,
  type BikeIntervalSnapshot,
} from "@/lib/bike-interval-timer";
import {
  releaseSetWakeLock,
  requestSetWakeLock,
  signalBikeIntervalCue,
} from "@/lib/bike-interval-signals";
import { formatRestClock } from "@/lib/rest-timer";

function BikeIntervalStrip({
  session,
  activeRound,
  phase,
}: {
  session: BikeSession;
  activeRound: number;
  phase: BikeIntervalPhase;
}) {
  const longClock = isLongBikeClock(session);
  const compact = session.roundsPerSet > 8;

  return (
    <div className="mt-3 rounded-xl border border-line bg-background p-3" data-bike-intervals>
      <p className="font-display text-xs uppercase tracking-wide text-highlighter">
        {bikeIntervalChrome(session)}
      </p>
      {longClock ? (
        <div
          data-bike-tile={1}
          data-bike-tile-active={phase === "work" || phase === "rest" ? phase : undefined}
          className={`mt-2 rounded-lg px-3 py-3 text-center ${
            phase === "work" ? "bg-black ring-2 ring-[#CBF805]" : "bg-black"
          }`}
        >
          <p className="font-display text-sm leading-none text-[#CBF805]">
            {formatRestClock(session.workSeconds)}
          </p>
          <p className="mt-1 text-[10px] text-white">one work block</p>
        </div>
      ) : compact ? (
        <p className="mt-2 text-xs text-muted">
          {session.roundsPerSet} timed rounds — the Start set clock drives work
          {session.restSeconds > 0 ? " and rest" : ""}.
        </p>
      ) : (
        <ol className="mt-2 grid grid-cols-4 gap-1.5">
          {Array.from({ length: session.roundsPerSet }, (_, index) => {
            const round = index + 1;
            const current = activeRound === round && (phase === "work" || phase === "rest");
            return (
              <li
                key={index}
                data-bike-tile={round}
                data-bike-tile-active={current ? phase : undefined}
                className={`rounded-lg px-1.5 py-1.5 text-center ${
                  current
                    ? phase === "work"
                      ? "bg-black ring-2 ring-[#CBF805]"
                      : "bg-black ring-2 ring-white"
                    : "bg-black"
                }`}
              >
                <p className="font-display text-[11px] leading-none text-[#CBF805]">
                  {session.workSeconds}s
                </p>
                <p className="mt-0.5 text-[9px] text-white">work</p>
                {session.restSeconds > 0 ? (
                  <p className="text-[9px] text-white/80">{session.restSeconds}s rest</p>
                ) : (
                  <p className="text-[9px] text-white/80">no rest</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function BikeSetTimer({
  session,
  canStart,
  onSetComplete,
}: {
  session: BikeSession;
  canStart: boolean;
  onSetComplete: () => void;
}) {
  const spec = {
    workSeconds: session.workSeconds,
    restSeconds: session.restSeconds,
    roundsPerSet: session.roundsPerSet,
  };
  const [clock, setClock] = useState<BikeIntervalSnapshot>(() => idleBikeInterval(spec));
  const wakeLock = useRef<{ release: () => Promise<void> | void } | null>(null);
  const completeRef = useRef(onSetComplete);
  const running = clock.phase === "work" || clock.phase === "rest";
  const longClock = isLongBikeClock(session);

  useEffect(() => {
    completeRef.current = onSetComplete;
  }, [onSetComplete]);

  useEffect(() => {
    setClock(idleBikeInterval(spec));
    // Reset only when the session prescription changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.workSeconds, spec.restSeconds, spec.roundsPerSet]);

  useEffect(() => {
    if (!running || clock.paused) return;
    const id = window.setInterval(() => {
      setClock((current) => {
        const { snapshot, cue } = tickBikeInterval(current);
        if (cue !== "none") signalBikeIntervalCue(cue);
        if (snapshot.phase === "done") {
          completeRef.current();
          releaseSetWakeLock(wakeLock.current);
          wakeLock.current = null;
          return idleBikeInterval(current.spec);
        }
        return snapshot;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, clock.paused]);

  useEffect(() => {
    return () => {
      releaseSetWakeLock(wakeLock.current);
      wakeLock.current = null;
    };
  }, []);

  async function holdAwake() {
    if (wakeLock.current) return;
    wakeLock.current = await requestSetWakeLock();
  }

  function handleStart() {
    if (!canStart || running) return;
    signalBikeIntervalCue("phase");
    setClock(startBikeInterval(spec));
    void holdAwake();
  }

  function handlePause() {
    setClock((current) => pauseBikeInterval(current));
    releaseSetWakeLock(wakeLock.current);
    wakeLock.current = null;
  }

  function handleResume() {
    setClock((current) => resumeBikeInterval(current));
    void holdAwake();
  }

  function handleStop() {
    setClock((current) => stopBikeInterval(current));
    releaseSetWakeLock(wakeLock.current);
    wakeLock.current = null;
  }

  const workPhase = clock.phase === "work";

  return (
    <div data-bike-set-timer>
      {running ? (
        <div
          data-bike-interval-board
          data-bike-interval-phase={clock.phase}
          className={`mt-3 rounded-2xl px-4 py-5 text-center ${
            workPhase ? "bg-black text-[#CBF805]" : "bg-black text-white"
          }`}
        >
          <p
            data-bike-interval-round
            className="font-display text-xs uppercase tracking-[0.16em] text-white/80"
          >
            {longClock
              ? "Work block"
              : `Round ${clock.round}/${session.roundsPerSet}`}
          </p>
          <p
            className={`font-display mt-2 text-lg uppercase tracking-[0.18em] ${
              workPhase ? "text-[#CBF805]" : "text-white"
            }`}
          >
            {workPhase ? "WORK" : "REST"}
          </p>
          <p
            data-bike-interval-clock
            className={`stat-display mt-3 text-6xl leading-none ${
              workPhase ? "text-[#CBF805]" : "text-white"
            }`}
          >
            {formatRestClock(clock.remainingSeconds)}
          </p>
        </div>
      ) : null}

      <BikeIntervalStrip
        session={session}
        activeRound={running ? clock.round : 0}
        phase={clock.phase}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {!running ? (
          <button
            type="button"
            data-bike-start-set
            disabled={!canStart}
            onClick={handleStart}
            className="font-display inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm uppercase tracking-wide text-black disabled:opacity-50"
          >
            Start set
          </button>
        ) : clock.paused ? (
          <button
            type="button"
            data-bike-resume
            onClick={handleResume}
            className="font-display inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm uppercase tracking-wide text-black"
          >
            Resume
          </button>
        ) : (
          <button
            type="button"
            data-bike-pause
            onClick={handlePause}
            className="font-display inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm uppercase tracking-wide"
          >
            Pause
          </button>
        )}
        {running ? (
          <button
            type="button"
            data-bike-stop
            onClick={handleStop}
            className="font-display inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm uppercase tracking-wide"
          >
            Stop
          </button>
        ) : null}
      </div>
    </div>
  );
}
