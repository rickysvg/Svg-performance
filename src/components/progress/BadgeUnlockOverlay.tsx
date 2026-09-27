"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { loadUnlockBadgesAction, markBadgeUnlocksSeenAction } from "@/app/actions/badges";
import { BadgeMark } from "@/components/progress/BadgeMark";
import { BadgeSparks } from "@/components/progress/BadgeSparks";
import { badgeShareStats, parseUnlockQuery } from "@/lib/badge-unlocks";
import { BADGE_CATEGORY_LABEL, type BadgeCategoryId, type EarnedBadge } from "@/lib/badges";
import { playCategorySfx, soundFxEnabled } from "@/lib/badge-sfx";
import { renderShareCardBlob, shareOrDownloadCard } from "@/lib/share-card-render";
import type { UnlockBadgePayload } from "@/app/actions/badges";
import type { LoadUnit } from "@/lib/units";

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function toBadge(row: UnlockBadgePayload): EarnedBadge {
  return {
    ...row,
    earned: true,
    earnedAt: new Date(),
    progressCurrent: 1,
    progressTarget: 1,
    progressLabel: "",
  };
}

export function BadgeUnlockOverlay() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const unlockParam = params.get("unlock");
  const ids = useMemo(() => parseUnlockQuery(unlockParam), [unlockParam]);
  const queueKey = ids.join(",");
  const preview = params.get("unlockPreview") === "1";
  const [queue, setQueue] = useState<UnlockBadgePayload[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [index, setIndex] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [tip, setTip] = useState("");
  const reduce = prefersReducedMotion();
  const current = queueKey && loadedKey === queueKey ? (queue[index] ?? null) : null;

  useEffect(() => {
    if (!queueKey) return;
    let alive = true;
    void loadUnlockBadgesAction(ids).then((rows) => {
      if (!alive) return;
      setQueue(rows);
      setIndex(0);
      setLoadedKey(queueKey);
    });
    return () => {
      alive = false;
    };
  }, [ids, queueKey]);

  useEffect(() => {
    if (!current) return;
    if (!preview) {
      void markBadgeUnlocksSeenAction([current.id]);
    }
    const category = current.category as BadgeCategoryId;
    const buzz = window.setTimeout(() => {
      if (!reduce && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([40, 30, 18, 40, 12]);
      }
      if (soundFxEnabled()) {
        void playCategorySfx(category);
      }
    }, reduce ? 80 : 700);
    return () => {
      window.clearTimeout(buzz);
    };
  }, [current, preview, reduce]);

  function clearUnlockParams() {
    const next = new URLSearchParams(params.toString());
    next.delete("unlock");
    next.delete("unlockPreview");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function keepGoing() {
    if (index + 1 < queue.length) {
      setIndex((value) => value + 1);
      setTip("");
      return;
    }
    clearUnlockParams();
  }

  async function onShare() {
    if (!current) return;
    setSharing(true);
    setTip("");
    try {
      const blob = await renderShareCardBlob({
        style: "black",
        title: current.title,
        stats: badgeShareStats(current),
      });
      const result = await shareOrDownloadCard(blob, `svg-performance-${current.id}.png`);
      if (result === "downloaded") {
        setTip("Image saved. Open Instagram and add it to your story.");
      }
    } catch {
      setTip("Could not share. Try again.");
    } finally {
      setSharing(false);
    }
  }

  if (!current) return null;
  const badge = toBadge(current);
  const unit = (current.unit ?? "lb") as LoadUnit;
  const categoryLabel = BADGE_CATEGORY_LABEL[current.category];

  return (
    <div
      className="badge-unlock-backdrop fixed inset-0 z-[90] flex items-center justify-center overflow-hidden px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-unlock-title"
      data-badge-unlock="1"
      data-badge-style="category"
      data-badge-id={current.id}
      data-badge-category={current.category}
    >
      <div className="badge-unlock-glow" aria-hidden />
      {reduce ? null : <div className="badge-unlock-rays" aria-hidden />}
      <div className="relative w-full max-w-sm text-center text-white">
        <div
          className={`badge-unlock-stage relative mx-auto flex h-[320px] w-[320px] items-center justify-center ${
            reduce ? "" : "badge-unlock-shake"
          }`}
        >
          <BadgeSparks key={current.id} active={!reduce} delayMs={900} />
          <div className={reduce ? "badge-unlock-fade" : "badge-unlock-fly"}>
            <div className="relative">
              <BadgeMark badge={badge} unit={unit} hero motion={false} />
              <svg className="badge-unlock-ring" viewBox="0 0 100 100" aria-hidden>
                <circle
                  className={reduce ? "badge-unlock-ring-fade" : "badge-unlock-ring-stroke"}
                  cx="50"
                  cy="50"
                  r="46"
                  pathLength={1}
                />
                {reduce ? null : <circle className="badge-unlock-ring-tip" r="2.4" />}
              </svg>
            </div>
          </div>
        </div>
        <div className={reduce ? "" : "badge-unlock-copy"}>
          <p className="font-display inline-flex rounded-full bg-accent px-3 py-1 text-[11px] uppercase tracking-wide text-black">
            {categoryLabel}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/70">Badge unlocked</p>
          <h2 id="badge-unlock-title" className="font-display mt-2 text-4xl uppercase tracking-wide text-white">
            {current.title}
          </h2>
          <p className="mt-2 text-sm text-white/55">{current.hint}</p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void onShare()}
              disabled={sharing}
              className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
            >
              {sharing ? "Preparing…" : "Share"}
            </button>
            <button
              type="button"
              onClick={keepGoing}
              className="touch-target w-full rounded-full border border-white/40 text-white"
            >
              Keep going
            </button>
          </div>
          {tip ? <p className="mt-3 text-sm text-white/70">{tip}</p> : null}
        </div>
      </div>
    </div>
  );
}
