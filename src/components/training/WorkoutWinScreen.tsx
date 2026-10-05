"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CelebrationFx, preloadFxSheets } from "@/components/progress/SpriteFx";
import { playFinishSfx, primeUnlockAudio, soundFxEnabled } from "@/lib/badge-sfx";
import { parseUnlockQuery } from "@/lib/badge-unlocks";
import { SessionFeelPicker } from "@/components/training/SessionFeelPicker";
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
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pending = parseUnlockQuery(params.get("pendingUnlock") ?? params.get("unlock"));
  const [open, setOpen] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [tip, setTip] = useState("");
  const reduce = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);

  useEffect(() => {
    void preloadFxSheets();
    primeUnlockAudio();
  }, []);

  useEffect(() => {
    if (!open) return;
    const buzz = window.setTimeout(() => {
      if (!reduce && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([28, 22, 48]);
      }
      if (soundFxEnabled()) {
        playFinishSfx();
      }
    }, reduce ? 40 : 700);
    return () => window.clearTimeout(buzz);
  }, [open, reduce]);

  function onDone() {
    setOpen(false);
    window.dispatchEvent(new Event("svg-workout-win-done"));
    if (pending.length === 0) {
      router.replace("/home");
    }
  }

  async function onShare() {
    setSharing(true);
    setTip("");
    try {
      const blob = await renderShareCardBlob({
        style: "black",
        title: shareTitle,
        stats: shareStats,
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

  if (!open) return null;

  return (
    <div
      className="workout-win-backdrop fixed inset-0 z-[80] overflow-y-auto px-5 py-8"
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
          className={`relative mt-4 flex h-[280px] w-[280px] items-center justify-center overflow-visible ${
            reduce ? "" : "badge-unlock-shake"
          }`}
        >
          {reduce ? null : (
            <div
              data-win-sparks
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[min(720px,170vw)] w-[min(720px,170vw)] -translate-x-1/2 -translate-y-1/2 overflow-visible"
            >
              <CelebrationFx active delayMs={700} size={680} />
            </div>
          )}
          <div className={`relative z-20 ${reduce ? "badge-unlock-fade" : "badge-unlock-fly"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/workout_complete_hero.webp"
              alt=""
              width={240}
              height={240}
              className="workout-win-crest mx-auto"
              draggable={false}
            />
          </div>
        </div>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
          {dateLine} · Session {sessionNumber}
        </p>
        <h1 id="workout-win-title" className="font-display mt-3 text-[34px] uppercase leading-none tracking-wide">
          {workoutCompleteHeadline()}
        </h1>
        <SessionFeelPicker workoutId={workoutId} current={difficultyRating} />
        <dl className="mt-6 grid w-full grid-cols-2 gap-2">
          {tiles.map((tile) => (
            <div key={tile.key} className="rounded-2xl bg-black px-3 py-4" data-win-stat={tile.key}>
              <dt className="font-display text-[11px] uppercase tracking-[0.12em] text-white/55">{tile.label}</dt>
              <dd className="stat-display mt-1 text-[34px] leading-none text-[#cbf805]">{tile.value}</dd>
            </div>
          ))}
        </dl>
        {badgeTitle ? (
          <div className="mt-4 w-full rounded-2xl border border-white/15 bg-black px-4 py-3" data-win-badge="1">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Badge earned</p>
            <p className="font-display mt-1 text-xl uppercase tracking-wide text-[#cbf805]">{badgeTitle}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onDone}
          className="touch-target mt-6 w-full rounded-full bg-[#cbf805] text-black"
          data-win-done="1"
        >
          DONE
        </button>
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
      </div>
    </div>
  );
}
