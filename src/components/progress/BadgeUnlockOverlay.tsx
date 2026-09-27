"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { loadUnlockBadgesAction, markBadgeUnlocksSeenAction } from "@/app/actions/badges";
import { BadgeMark } from "@/components/progress/BadgeMark";
import { BadgeSparks } from "@/components/progress/BadgeSparks";
import { BadgeUnlockOutline } from "@/components/progress/BadgeUnlockOutline";
import { badgeShareStats, parseUnlockQuery, unlockLine } from "@/lib/badge-unlocks";
import { plateWebp } from "@/lib/badge-plates";
import { renderShareCardBlob, shareOrDownloadCard } from "@/lib/share-card-render";
import type { EarnedBadge } from "@/lib/badges";
import type { UnlockBadgePayload } from "@/app/actions/badges";

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
    if (reduce || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
      return;
    }
    const buzz = window.setTimeout(() => {
      navigator.vibrate([18, 32, 22]);
    }, 700);
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
  const specMask = plateWebp(badge.tier, 512);

  return (
    <div
      className="badge-unlock-backdrop fixed inset-0 z-50 flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-unlock-title"
      data-badge-unlock="1"
      data-badge-style="belt"
      data-badge-id={current.id}
    >
      <div className="badge-unlock-glow" aria-hidden />
      {reduce ? null : (
        <>
          <div className="badge-unlock-smoke badge-unlock-smoke-a" aria-hidden />
          <div className="badge-unlock-smoke badge-unlock-smoke-b" aria-hidden />
        </>
      )}
      <div className="relative w-full max-w-sm text-center text-white">
        <div
          className={`badge-unlock-stage relative mx-auto flex h-[300px] w-[300px] items-center justify-center ${
            reduce ? "" : "badge-unlock-shake"
          }`}
        >
          <div className="badge-unlock-shadow" aria-hidden />
          <BadgeSparks key={current.id} active={!reduce} delayMs={900} />
          <div className={reduce ? "badge-unlock-fade" : "badge-unlock-fly"}>
            <div className="relative">
              <BadgeMark badge={badge} motion={false} large shine={false} />
              {reduce ? null : (
                <span
                  className="badge-unlock-spec"
                  style={{
                    WebkitMaskImage: `url(${specMask})`,
                    maskImage: `url(${specMask})`,
                  }}
                  aria-hidden
                />
              )}
              <BadgeUnlockOutline fade={reduce} />
            </div>
          </div>
        </div>
        <div className={reduce ? "" : "badge-unlock-copy"}>
          <h2 id="badge-unlock-title" className="font-display mt-4 text-3xl uppercase tracking-wide text-white">
            {unlockLine(current.title)}
          </h2>
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
