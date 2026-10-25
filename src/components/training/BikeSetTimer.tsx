"use client";

import { useEffect, useRef, useState } from "react";
import {
  bikeIntervalChrome,
  isLongBikeClock,
  type BikeSession,
} from "@/lib/bike-sessions";
import {
  bikeSetDurationSeconds,
  completedBikeLogRounds,
  idleBikeInterval,
  pauseBikeInterval,
  resumeBikeInterval,
  startBikeInterval,
  stopBikeInterval,
  tickBikeInterval,
  type BikeIntervalPhase,
  type BikeIntervalSnapshot,
  type BikeIntervalSpec,
} from "@/lib/bike-interval-timer";
import {
  releaseSetWakeLock,
  requestSetWakeLock,
  signalBikeIntervalCue,
} from "@/lib/bike-interval-signals";
import { holdMediaRoute, primeMediaOutput } from "@/lib/media-output";
import { formatRestClock } from "@/lib/rest-timer";
import { CountdownFace } from "@/components/timer/CountdownFace";
import { useGoCountdown } from "@/components/timer/useGoCountdown";
import { TIMER_PREFS_STORAGE_KEY, parseStoredTimerPrefs } from "@/lib/round-timer";

function specFromSession(session: BikeSession): BikeIntervalSpec {
  return {
    workSeconds: session.workSeconds,
    restSeconds: session.restSeconds,
    roundsPerSet: session.roundsPerSet,
    warmupSeconds: session.warmupSeconds,
    cooldownSeconds: session.cooldownSeconds,
    blocks: session.blocks,
    restBetweenBlocksSeconds: session.restBetweenBlocksSeconds,
    repeatRounds: session.repeatRounds,
    restBetweenRoundsSeconds: session.restBetweenRoundsSeconds,
    pattern: session.pattern,
    ladder: session.ladder,
  };
}

function phaseWord(phase: BikeIntervalPhase, label?: string) {
  if (label) return label;
  if (phase === "work") return "WORK";
  if (phase === "warmup") return "WARM-UP";
  if (phase === "cooldown") return "COOL-DOWN";
  if (phase === "moderate") return "MODERATE";
  if (phase === "rest") return "REST";
  return "";
}

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
        {session.chooserLabel || bikeIntervalChrome(session)}
      </p>
      {session.chooserLabel ? (
        <p className="mt-2 text-xs text-muted">
          {bikeSetDurationSeconds(specFromSession(session)) >= 60
            ? "Start set runs this whole workout, including the easy spins."
            : "Start set runs this workout."}
        </p>
      ) : longClock ? (
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
  onFinishedRounds,
  onRideSeconds,
  bell,
  vibrate,
}: {
  session: BikeSession;
  canStart: boolean;
  onSetComplete: () => void;
  /** Called with the number of work rounds that have fully elapsed. */
  onFinishedRounds?: (count: number) => void;
  /** Seconds the interval clock has been running. 0 while it is idle. */
  onRideSeconds?: (seconds: number) => void;
  bell?: boolean;
  vibrate?: boolean;
}) {
  const spec = specFromSession(session);
  const [clock, setClock] = useState<BikeIntervalSnapshot>(() => idleBikeInterval(spec));
  const wakeLock = useRef<{ release: () => Promise<void> | void } | null>(null);
  const routeRelease = useRef<(() => void) | null>(null);
  const completeRef = useRef(onSetComplete);
  const finishedRef = useRef(onFinishedRounds);
  const rideRef = useRef(onRideSeconds);
  const pendingRounds = useRef(0);
  const pendingComplete = useRef(false);
  const countdown = useGoCountdown();
  const running =
    clock.phase === "work" ||
    clock.phase === "rest" ||
    clock.phase === "warmup" ||
    clock.phase === "cooldown" ||
    clock.phase === "moderate";

  useEffect(() => {
    completeRef.current = onSetComplete;
  }, [onSetComplete]);

  useEffect(() => {
    finishedRef.current = onFinishedRounds;
  }, [onFinishedRounds]);

  useEffect(() => {
    rideRef.current = onRideSeconds;
  }, [onRideSeconds]);

  useEffect(() => {
    const riding =
      clock.phase === "work" ||
      clock.phase === "rest" ||
      clock.phase === "warmup" ||
      clock.phase === "cooldown" ||
      clock.phase === "moderate";
    rideRef.current?.(riding ? clock.elapsedSeconds : 0);
  }, [clock]);

  useEffect(() => {
    const count = Math.max(completedBikeLogRounds(clock), pendingRounds.current);
    if (count > 0) finishedRef.current?.(count);
  }, [clock]);

  useEffect(() => {
    if (!pendingComplete.current) return;
    pendingComplete.current = false;
    completeRef.current();
  }, [clock]);

  useEffect(() => {
    if (!running || clock.paused) return;
    const id = window.setInterval(() => {
      setClock((current) => {
        const { snapshot, cue } = tickBikeInterval(current);
        if (cue !== "none") signalBikeIntervalCue(cue);
        if (snapshot.phase === "done") {
          pendingComplete.current = true;
          pendingRounds.current = completedBikeLogRounds(snapshot);
          releaseSetWakeLock(wakeLock.current);
          wakeLock.current = null;
          routeRelease.current?.();
          routeRelease.current = null;
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
      routeRelease.current?.();
      routeRelease.current = null;
    };
  }, []);

  async function holdAwake() {
    if (wakeLock.current) return;
    wakeLock.current = await requestSetWakeLock();
  }

  function soundPrefs() {
    if (typeof bell === "boolean" || typeof vibrate === "boolean") {
      return { bell: bell !== false, vibrate: vibrate !== false };
    }
    const stored = parseStoredTimerPrefs(window.localStorage.getItem(TIMER_PREFS_STORAGE_KEY));
    return { bell: stored.bell, vibrate: stored.vibrate };
  }

  function handleStart() {
    if (!canStart || running || countdown.active) return;
    primeMediaOutput();
    routeRelease.current?.();
    routeRelease.current = holdMediaRoute();
    countdown.begin({
      ...soundPrefs(),
      onGo: () => {
        setClock(startBikeInterval(spec));
        void holdAwake();
      },
    });
  }

  function handlePause() {
    setClock((current) => pauseBikeInterval(current));
    releaseSetWakeLock(wakeLock.current);
    wakeLock.current = null;
  }

  function handleResume() {
    if (countdown.active) return;
    primeMediaOutput();
    countdown.begin({
      ...soundPrefs(),
      onGo: () => {
        setClock((current) => resumeBikeInterval(current));
        void holdAwake();
      },
    });
  }

  function handleStop() {
    countdown.cancel();
    setClock((current) => stopBikeInterval(current));
    releaseSetWakeLock(wakeLock.current);
    wakeLock.current = null;
    routeRelease.current?.();
    routeRelease.current = null;
  }

  const workPhase = clock.phase === "work";
  const warn = workPhase && clock.remainingSeconds > 0 && clock.remainingSeconds <= 3;
  const word = phaseWord(clock.phase, clock.phaseLabel);
  const roundTotal = clock.roundTotal ?? session.roundsPerSet;
  const repeatRound = Math.max(1, clock.repeatRound ?? 1);
  const repeatTotal = Math.max(1, clock.repeatTotal ?? session.repeatRounds ?? 1);
  const sprint = clock.sprint ?? (clock.round > 0 ? clock.round : 0);
  const sprintTotal = clock.sprintTotal ?? roundTotal;

  return (
    <div data-bike-set-timer>
      {countdown.active && countdown.digit ? (
        <div className="mt-3 rounded-2xl bg-black px-4 py-5" data-bike-countdown>
          <CountdownFace digit={countdown.digit} />
        </div>
      ) : null}
      {running && !countdown.active ? (
        <div
          data-bike-interval-board
          data-bike-interval-phase={clock.phase}
          className="mt-3 rounded-2xl bg-black px-4 py-5 text-center text-white"
        >
          <p
            data-bike-interval-round
            className="font-display text-xs uppercase tracking-[0.06em] text-white/80"
          >
            {`Round ${repeatRound}/${repeatTotal}`}
          </p>
          {sprint > 0 ? (
            <p
              data-bike-interval-sprint
              className="font-display mt-1 text-sm uppercase tracking-[0.08em] text-[#CBF805]"
            >
              {`Sprint ${sprint}/${sprintTotal}`}
            </p>
          ) : null}
          <p
            data-bike-interval-word
            className={`font-display mt-2 text-lg uppercase ${
              warn ? "text-signal" : workPhase ? "text-[#CBF805]" : "text-white"
            }`}
          >
            {word}
          </p>
          <p
            data-bike-interval-clock
            className={`stat-display mt-3 text-6xl leading-none ${
              warn ? "text-signal" : workPhase ? "text-[#CBF805]" : "text-white"
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
        {countdown.active ? (
          <button
            type="button"
            data-bike-stop
            onClick={handleStop}
            className="font-display inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm uppercase tracking-wide"
          >
            Reset
          </button>
        ) : !running ? (
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
        {running && !countdown.active ? (
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
