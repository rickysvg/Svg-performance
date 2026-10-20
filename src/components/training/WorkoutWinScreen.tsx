"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CelebrationFx, preloadFxSheets } from "@/components/progress/SpriteFx";
import { playFinishSfx, primeUnlockAudio, soundFxEnabled } from "@/lib/badge-sfx";
import { resumeWorkoutAction } from "@/app/actions/workouts";
import { SessionFeelPicker } from "@/components/training/SessionFeelPicker";
import { SessionRecap } from "@/components/training/SessionRecap";
import type { SessionSummary } from "@/lib/session-summary";
import { workoutCompleteHeadline, type WorkoutCompleteTile } from "@/lib/workout-complete";
import { renderShareCardBlob, shareOrDownloadCard } from "@/lib/share-card-render";
import type { ShareStat } from "@/lib/share-card";
import type { LoadUnit } from "@/lib/units";

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function reducedMotionNow() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WorkoutWinScreen({
  dateLine,
  sessionNumber,
  tiles,
  shareTitle,
  shareStats,
  badgeTitle,
  unit,
  workoutId,
  difficultyRating,
  summary,
}: {
  dateLine: string;
  sessionNumber: number;
  tiles: WorkoutCompleteTile[];
  shareTitle: string;
  shareStats: ShareStat[];
  badgeTitle?: string | null;
  unit: LoadUnit;
  workoutId: string;
  difficultyRating: string;
  summary?: SessionSummary | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [sharing, setSharing] = useState(false);
  const [tip, setTip] = useState("");
  const reduce = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);

  useEffect(() => {
    void preloadFxSheets();
    primeUnlockAudio();
  }, []);

  useEffect(() => {
    const buzz = window.setTimeout(() => {
      if (!reduce && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([28, 22, 48]);
      }
      if (soundFxEnabled()) {
        playFinishSfx();
      }
    }, reduce ? 40 : 700);
    return () => window.clearTimeout(buzz);
  }, [reduce]);

  function onDone() {
    const unlock = params.get("unlock") ?? params.get("pendingUnlock");
    const href = unlock ? `/home?unlock=${encodeURIComponent(unlock)}` : "/home";
    router.replace(href);
  }

  async function onShare() {
    setSharing(true);
    setTip("");
    try {
      const blob = await renderShareCardBlob({
        style: "black",
        title: shareTitle,
        stats: shareStats,
        summary,
      });
      const result = await shareOrDownloadCard(blob, "svg-performance-session.png");
      if (result === "downloaded") {
        setTip("Image saved. Open Instagram and add it to your story.");
      }
    } catch {
      setTip("Could not share. Try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div
      className="workout-win-backdrop fixed inset-0 z-[80] overflow-x-hidden overflow-y-auto px-5 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-win-title"
      data-workout-win="1"
      data-unit={unit}
      data-pathname={pathname}
    >
      <div className="workout-win-glow" aria-hidden />
      <div className="relative mx-auto flex min-h-full w-full max-w-sm flex-col items-center text-center text-white">
        <div
          className={`relative mt-2 flex h-28 w-28 items-center justify-center overflow-visible ${
            reduce ? "" : "badge-unlock-shake"
          }`}
        >
          {reduce ? null : (
            <div
              data-win-sparks
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-72 w-72 max-w-full -translate-x-1/2 -translate-y-1/2 overflow-hidden"
            >
              <CelebrationFx active delayMs={700} size={680} />
            </div>
          )}
          <div className={`relative z-20 ${reduce ? "badge-unlock-fade" : "badge-unlock-fly"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/workout_complete_hero.webp"
              alt=""
              width={112}
              height={112}
              className="workout-win-crest mx-auto h-24 w-24"
              draggable={false}
            />
          </div>
        </div>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
          {dateLine} · Session {sessionNumber}
        </p>
        <h1 id="workout-win-title" className="font-display mt-2 text-3xl uppercase leading-none tracking-wide">
          {workoutCompleteHeadline()}
        </h1>
        <p
          className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#cbf805]"
          data-workout-saved
        >
          Saved
        </p>
        <SessionFeelPicker workoutId={workoutId} current={difficultyRating} />
        <p className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm">
          {tiles.map((tile) => (
            <span key={tile.key} data-win-stat={tile.key}>
              <span className="text-white/55">{tile.label}</span>{" "}
              <span className="font-semibold text-[#cbf805]">{tile.value}</span>
            </span>
          ))}
        </p>
        <button
          type="button"
          onClick={onDone}
          className="touch-target mt-5 w-full rounded-full bg-[#cbf805] text-black"
          data-win-done="1"
        >
          DONE
        </button>
        <form action={resumeWorkoutAction} className="mt-2 w-full">
          <input type="hidden" name="workoutId" value={workoutId} />
          <button
            type="submit"
            className="touch-target w-full text-sm text-white/80 underline-offset-4 hover:underline"
            data-undo-finish="1"
          >
            Undo finish
          </button>
        </form>
        {badgeTitle ? (
          <div className="mt-4 w-full rounded-2xl border border-white/15 bg-black px-4 py-3" data-win-badge="1">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Badge earned</p>
            <p className="font-display mt-1 text-xl uppercase tracking-wide text-[#cbf805]">{badgeTitle}</p>
          </div>
        ) : null}
        {summary ? <SessionRecap summary={summary} /> : null}
        <button
          type="button"
          onClick={() => void onShare()}
          disabled={sharing}
          className="touch-target mt-2 w-full text-sm text-white/70 underline-offset-4 hover:underline disabled:opacity-60"
          data-win-share="1"
        >
          {sharing ? "Preparing…" : "Share session"}
        </button>
        {tip ? <p className="mt-3 text-sm text-white/70">{tip}</p> : null}
        <Link
          href={`/feedback?from=${encodeURIComponent(pathname)}&workout=${encodeURIComponent(workoutId)}`}
          className="mt-4 text-xs text-white/55 underline-offset-4 hover:underline"
          data-win-feedback="1"
        >
          Send feedback
        </Link>
      </div>
    </div>
  );
}
