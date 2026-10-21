"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { logBagworkSessionAction } from "@/app/actions/bagwork";
import { startRoundLogAction } from "@/app/actions/workouts";
import {
  DEFAULT_CUSTOM,
  DEFAULT_TIMER_PREFS,
  TIMER_CUSTOM_STORAGE_KEY,
  TIMER_PREFS_STORAGE_KEY,
  TIMER_MODES,
  type TimerConfig,
  type TimerMode,
  type TimerPhase,
  type TimerPreset,
  completedWorkRounds,
  configForPreset,
  formatTimerClock,
  parseStoredCustom,
  parseStoredTimerPrefs,
  resolveTimer,
  sanitizeTimerConfig,
  shouldPlayPhaseBell,
  shouldPlayWarningBeep,
} from "@/lib/round-timer";
import { holdMediaRoute, playSynthCue, primeMediaOutput } from "@/lib/media-output";

const MODE_LABEL: Record<TimerMode, string> = {
  bag: "Bag",
  pads: "Pads",
  sparring: "Sparring",
  grappling: "Grappling",
};

function playBell() {
  playSynthCue(660, 0.12, 0.7);
  window.setTimeout(() => playSynthCue(880, 0.16, 0.74), 90);
}

function playWarning() {
  playSynthCue(980, 0.14, 0.7);
}

async function requestWakeLock() {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    return (await nav.wakeLock?.request("screen")) ?? null;
  } catch {
    return null;
  }
}

export type RoundTimerLaunch = {
  key: string;
  name: string;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  backHref: string;
};

export function RoundTimer({
  launch = null,
  onClose,
  titleId,
}: {
  launch?: RoundTimerLaunch | null;
  onClose?: () => void;
  titleId?: string;
}) {
  const launchConfig = launch
    ? sanitizeTimerConfig({
        rounds: launch.rounds,
        workSeconds: launch.workSeconds,
        restSeconds: launch.restSeconds,
      })
    : null;
  const [prefs, setPrefs] = useState(
    launchConfig
      ? { ...DEFAULT_TIMER_PREFS, mode: "bag" as const, preset: "custom" as const, custom: launchConfig }
      : DEFAULT_TIMER_PREFS,
  );
  const [hydrated, setHydrated] = useState(false);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [pausedAtMs, setPausedAtMs] = useState<number | null>(null);
  const [pauseAccumulatedMs, setPauseAccumulatedMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [customDraft, setCustomDraft] = useState(launchConfig ?? DEFAULT_CUSTOM);
  const [notes, setNotes] = useState("");
  const [rpe, setRpe] = useState("");
  const [logState, setLogState] = useState<{ ok: true; sessionId: string } | { ok: false; error: string } | null>(
    null,
  );
  const [logHint, setLogHint] = useState("");
  const logged = useRef(false);
  const notesRef = useRef("");
  const rpeRef = useRef("");
  notesRef.current = notes;
  rpeRef.current = rpe;
  const prev = useRef<{ remaining: number; phase: TimerPhase }>({ remaining: 0, phase: "idle" });
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const routeRelease = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (launch) {
      const stamp = Date.now();
      setStartedAtMs(stamp);
      setPausedAtMs(null);
      setPauseAccumulatedMs(0);
      setNowMs(stamp);
      setHydrated(true);
      return;
    }
    const id = window.setTimeout(() => {
      const stored = parseStoredTimerPrefs(window.localStorage.getItem(TIMER_PREFS_STORAGE_KEY));
      const custom = parseStoredCustom(window.localStorage.getItem(TIMER_CUSTOM_STORAGE_KEY));
      setPrefs({ ...stored, custom });
      setCustomDraft(custom);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [launch]);

  useEffect(() => {
    if (!hydrated || launch) return;
    window.localStorage.setItem(TIMER_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    window.localStorage.setItem(TIMER_CUSTOM_STORAGE_KEY, JSON.stringify(prefs.custom));
  }, [hydrated, launch, prefs]);

  const config = useMemo(
    () => configForPreset(prefs.preset, prefs.preset === "custom" ? customDraft : prefs.custom),
    [prefs.preset, prefs.custom, customDraft],
  );
  const running = startedAtMs != null && pausedAtMs == null;
  const resolved = resolveTimer({
    config,
    startedAtMs,
    pausedAtMs,
    pauseAccumulatedMs,
    nowMs,
  });

  const writeLog = useCallback(
    (roundsDone: number) => {
      if (!launch || roundsDone < 1 || logged.current) return;
      logged.current = true;
      const parsedRpe = Number(rpeRef.current);
      void logBagworkSessionAction({
        workoutKey: launch.key,
        rounds: roundsDone,
        workSeconds: config.workSeconds,
        notes: notesRef.current,
        rpe: Number.isInteger(parsedRpe) ? parsedRpe : null,
      }).then((result) => setLogState(result));
    },
    [config.workSeconds, launch],
  );

  useEffect(() => {
    if (!launch || resolved.phase !== "done") return;
    writeLog(resolved.totalRounds);
  }, [launch, resolved.phase, resolved.totalRounds, writeLog]);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      setNowMs(Date.now());
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [running]);

  useEffect(() => {
    const sync = () => {
      setNowMs(Date.now());
      if (document.visibilityState === "visible" && running) {
        void requestWakeLock().then((lock) => {
          wakeLock.current = lock;
        });
      }
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
    };
  }, [running]);

  useEffect(() => {
    if (resolved.phase !== "done") return;
    routeRelease.current?.();
    routeRelease.current = null;
  }, [resolved.phase]);

  useEffect(() => {
    return () => {
      routeRelease.current?.();
      routeRelease.current = null;
    };
  }, []);

  useEffect(() => {
    if (!running) {
      void wakeLock.current?.release();
      wakeLock.current = null;
      return;
    }
    void requestWakeLock().then((lock) => {
      wakeLock.current = lock;
    });
    return () => {
      void wakeLock.current?.release();
      wakeLock.current = null;
    };
  }, [running]);

  useEffect(() => {
    const previous = prev.current;
    if (startedAtMs != null) {
      if (prefs.warningBeep && shouldPlayWarningBeep(previous.remaining, resolved.remainingSeconds)) {
        playWarning();
      }
      if (prefs.bell && shouldPlayPhaseBell(previous.phase, resolved.phase)) {
        playBell();
      }
      if (prefs.vibrate && previous.phase !== resolved.phase && resolved.phase !== "idle") {
        try {
          navigator.vibrate?.(resolved.phase === "rest" ? [80, 40, 80] : 120);
        } catch {
          /* optional */
        }
      }
    }
    prev.current = { remaining: resolved.remainingSeconds, phase: resolved.phase };
  }, [prefs.bell, prefs.vibrate, prefs.warningBeep, resolved.phase, resolved.remainingSeconds, startedAtMs]);

  const startOrPause = useCallback(() => {
    primeMediaOutput();
    if (!routeRelease.current) routeRelease.current = holdMediaRoute();
    const stamp = Date.now();
    if (startedAtMs == null || resolved.phase === "done") {
      setStartedAtMs(stamp);
      setPausedAtMs(null);
      setPauseAccumulatedMs(0);
      setNowMs(stamp);
      return;
    }
    if (pausedAtMs == null) {
      setPausedAtMs(stamp);
      setNowMs(stamp);
      return;
    }
    setPauseAccumulatedMs((value) => value + (stamp - pausedAtMs));
    setPausedAtMs(null);
    setNowMs(stamp);
  }, [pausedAtMs, resolved.phase, startedAtMs]);

  function reset() {
    routeRelease.current?.();
    routeRelease.current = null;
    setStartedAtMs(null);
    setPausedAtMs(null);
    setPauseAccumulatedMs(0);
    setNowMs(Date.now());
  }

  function persistCustom(next: TimerConfig) {
    setCustomDraft(next);
    setPrefs((current) => ({ ...current, preset: "custom", custom: next }));
    if (startedAtMs != null) reset();
  }

  const workTheme = resolved.phase !== "rest";
  const primaryLabel =
    startedAtMs == null || resolved.phase === "done" ? "Start" : pausedAtMs ? "Start" : "Pause";

  return (
    <div className="space-y-4 pb-4">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 bg-background px-4 py-2">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            autoFocus
            data-round-timer-close
            className="touch-target inline-flex items-center justify-center text-2xl leading-none"
            aria-label="Close timer"
          >
            ‹
          </button>
        ) : (
          <Link
            href={launch?.backHref ?? "/training"}
            className="touch-target inline-flex items-center justify-center text-2xl leading-none"
            aria-label={launch ? "Back to workout" : "Back to Train"}
          >
            ‹
          </Link>
        )}
        <h1 className="text-xl" id={titleId} data-timer-title>
          {launch ? launch.name : "Round timer"}
        </h1>
        <span className="w-8" aria-hidden />
      </div>

      {launch ? (
        <div className="space-y-3" data-bagwork-timer={running ? "running" : resolved.phase}>
          <p className="text-sm text-muted">
            {launch.name}. Finished rounds log themselves when the timer ends.
          </p>
          <label className="block text-sm">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Optional"
              className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            RPE
            <input
              value={rpe}
              onChange={(event) => setRpe(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
              inputMode="numeric"
              placeholder="1–10, optional"
              className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-2"
            />
          </label>
          {logHint ? <p className="text-sm text-signal">{logHint}</p> : null}
          {logState?.ok ? (
            <p className="text-sm" data-bagwork-logged>
              Logged {launch.name}.{" "}
              <Link href="/training/history" className="text-accent underline">
                Open history
              </Link>
            </p>
          ) : null}
          {logState && !logState.ok ? <p className="text-sm text-signal">{logState.error}</p> : null}
        </div>
      ) : null}

      {launch ? null : (
      <div className="grid grid-cols-4 gap-1 rounded-full bg-card p-1">
        {TIMER_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setPrefs((current) => ({ ...current, mode }))}
            className={`touch-target rounded-full px-1 text-[11px] ${
              prefs.mode === mode ? "bg-black text-white" : "text-muted"
            }`}
          >
            {MODE_LABEL[mode]}
          </button>
        ))}
      </div>
      )}

      {launch || onClose ? null : (
      <form action={startRoundLogAction} data-round-log="">
        <input type="hidden" name="mode" value={prefs.mode} />
        <input type="hidden" name="rounds" value={configForPreset(prefs.preset, customDraft).rounds} />
        <input
          type="hidden"
          name="workSeconds"
          value={configForPreset(prefs.preset, customDraft).workSeconds}
        />
        <button
          type="submit"
          className="touch-target w-full rounded-full bg-accent text-black"
        >
          Log {configForPreset(prefs.preset, customDraft).rounds} {MODE_LABEL[prefs.mode].toLowerCase()} rounds
        </button>
      </form>
      )}

      {launch ? null : (
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["3x3", "3 × 3 min", "1 min rest"],
            ["5x5", "5 × 5 min", "1 min rest"],
            ["custom", "Custom", "Set your own"],
          ] as const
        ).map(([id, title, hint]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setPrefs((current) => ({ ...current, preset: id as TimerPreset }));
              if (startedAtMs != null) reset();
            }}
            className={`min-h-16 rounded-2xl px-2 py-3 text-center ${
              prefs.preset === id ? "bg-accent text-black" : "bg-card text-foreground"
            }`}
          >
            <span className="block text-sm font-medium">{title}</span>
            <span className="mt-1 block text-[11px] opacity-70">{hint}</span>
          </button>
        ))}
      </div>
      )}

      {launch || prefs.preset === "custom" ? (
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-card p-3">
          <Stepper
            label="Rounds"
            value={customDraft.rounds}
            onChange={(rounds) => persistCustom({ ...customDraft, rounds })}
            min={1}
            max={20}
          />
          <Stepper
            label="Work min"
            value={Math.round(customDraft.workSeconds / 60)}
            onChange={(minutes) => persistCustom({ ...customDraft, workSeconds: minutes * 60 })}
            min={1}
            max={15}
          />
          <Stepper
            label="Rest min"
            value={Math.round(customDraft.restSeconds / 60)}
            onChange={(minutes) => persistCustom({ ...customDraft, restSeconds: minutes * 60 })}
            min={1}
            max={10}
          />
        </div>
      ) : null}

      <section
        data-round-clock
        data-timer-phase={resolved.phase}
        className={`rounded-[2rem] px-5 py-6 text-center ${
          workTheme ? "bg-accent text-black" : "bg-black text-highlighter"
        }`}
      >
        <p className="font-display text-xs uppercase tracking-[0.12em]">
          Round {resolved.round} of {resolved.totalRounds}
        </p>
        <p className="font-display mt-3 text-3xl uppercase tracking-[0.08em]">
          {resolved.phase === "rest" ? "Rest" : resolved.phase === "done" ? "Done" : "Work"}
        </p>
        <p className="stat-display mt-1 text-[6.25rem] leading-none">
          {formatTimerClock(resolved.remainingSeconds)}
        </p>
        <div
          className={`mx-auto mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full ${
            workTheme ? "bg-black/15" : "bg-white/20"
          }`}
        >
          <div
            className={`h-full ${workTheme ? "bg-black" : "bg-accent"}`}
            style={{ width: `${Math.round(resolved.phaseProgress * 100)}%` }}
          />
        </div>
        <div
          className={`mx-auto mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full ${
            workTheme ? "bg-black/10" : "bg-white/10"
          }`}
        >
          <div
            className={`h-full ${workTheme ? "bg-black/50" : "bg-accent/80"}`}
            style={{ width: `${Math.round(resolved.sessionProgress * 100)}%` }}
          />
        </div>
        <p className="mt-4 text-sm opacity-80">
          {resolved.phase === "done" ? resolved.nextLabel : `Next: ${resolved.nextLabel}`}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Toggle
          label="10-second warning beep"
          on={prefs.warningBeep}
          onClick={() => setPrefs((current) => ({ ...current, warningBeep: !current.warningBeep }))}
        />
        <Toggle
          label="Bell start/end"
          on={prefs.bell}
          onClick={() => setPrefs((current) => ({ ...current, bell: !current.bell }))}
        />
        <Toggle
          label="Vibrate"
          on={prefs.vibrate}
          onClick={() => setPrefs((current) => ({ ...current, vibrate: !current.vibrate }))}
        />
      </div>

      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={reset}
          className="flex flex-col items-center gap-2 text-xs uppercase tracking-wide"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-line text-xl">
            ↻
          </span>
          Reset
        </button>
        {launch ? (
          <button
            type="button"
            onClick={() => {
              const done = completedWorkRounds(resolved.phase, resolved.round, resolved.totalRounds);
              if (done < 1) {
                setLogHint("Finish a round before logging.");
                return;
              }
              setLogHint("");
              writeLog(done);
              reset();
            }}
            className="flex flex-col items-center gap-2 text-xs uppercase tracking-wide text-signal"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-signal text-sm">
              End
            </span>
            Log rounds
          </button>
        ) : null}
        <button
          type="button"
          onClick={startOrPause}
          data-timer-start={primaryLabel.toLowerCase()}
          className="flex flex-col items-center gap-2 text-xs uppercase tracking-wide"
        >
          <span
            className={`flex h-20 w-20 items-center justify-center rounded-full text-sm uppercase tracking-wide ${
              primaryLabel === "Pause" ? "bg-black text-highlighter" : "bg-accent text-black"
            }`}
          >
            {primaryLabel === "Pause" ? "❚❚" : "▶"}
          </span>
          {primaryLabel}
        </button>
      </div>

    </div>
  );
}

function Toggle({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`touch-target inline-flex items-center rounded-full border px-3 text-sm ${
        on ? "border-black bg-accent text-black" : "border-line text-muted"
      }`}
    >
      {on ? "✓ " : ""}
      {label}
    </button>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="block text-center text-xs uppercase tracking-wide text-muted">
      {label}
      <span className="mt-2 flex items-center justify-center gap-1">
        <button
          type="button"
          className="touch-target inline-flex w-10 items-center justify-center rounded-full border border-line"
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <span className="stat-display w-8 text-lg text-foreground">{value}</span>
        <button
          type="button"
          className="touch-target inline-flex w-10 items-center justify-center rounded-full border border-line"
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </span>
    </label>
  );
}
