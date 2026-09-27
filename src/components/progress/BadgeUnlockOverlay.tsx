"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { loadUnlockBadgesAction, markBadgeUnlocksSeenAction } from "@/app/actions/badges";
import { BadgeMark } from "@/components/progress/BadgeMark";
import { BadgeSparks } from "@/components/progress/BadgeSparks";
import { preloadFxSheets } from "@/components/progress/SpriteFx";
import { badgeShareStats, capUnlockQueue, parseUnlockQuery, unlockMoreLine } from "@/lib/badge-unlocks";
import { BADGE_CATEGORY_LABEL, type EarnedBadge } from "@/lib/badges";
import { playUnlockSfx, soundFxEnabled } from "@/lib/badge-sfx";
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
  const onDonePath = /\/training\/log\/[^/]+\/done/.test(pathname);
  const [winDone, setWinDone] = useState(false);
  const released = !onDonePath || winDone;
  const [queue, setQueue] = useState<UnlockBadgePayload[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [tip, setTip] = useState("");
  const reduce = prefersReducedMotion();
  const capped = capUnlockQueue(queue);
  const current =
    queueKey && loadedKey === queueKey && released && !summary ? (capped.shown[index] ?? null) : null;

  useEffect(() => {
    const onDone = () => setWinDone(true);
    window.addEventListener("svg-workout-win-done", onDone);
    return () => window.removeEventListener("svg-workout-win-done", onDone);
  }, []);

  useEffect(() => {
    void preloadFxSheets();
  }, []);

  useEffect(() => {
    if (!queueKey || !released) return;
    let alive = true;
    void loadUnlockBadgesAction(ids).then((rows) => {
      if (!alive) return;
      setQueue(rows);
      setIndex(0);
      setSummary(false);
      setLoadedKey(queueKey);
    });
    return () => {
      alive = false;
    };
  }, [ids, queueKey, released]);

  useEffect(() => {
    if (!released || !queueKey || preview) return;
    void markBadgeUnlocksSeenAction(ids);
  }, [ids, preview, queueKey, released]);

  useEffect(() => {
    if (!current) return;
    const buzz = window.setTimeout(() => {
      if (!reduce && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([40, 30, 18, 40, 12]);
      }
      if (soundFxEnabled()) {
        void playUnlockSfx();
      }
    }, reduce ? 80 : 700);
    return () => {
      window.clearTimeout(buzz);
    };
  }, [current, reduce]);

  function clearUnlockParams() {
    const next = new URLSearchParams(params.toString());
    next.delete("unlock");
    next.delete("unlockPreview");
    next.delete("pendingUnlock");
    const qs = next.toString();
    if (onDonePath) {
      router.replace("/home");
      return;
    }
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function keepGoing() {
    if (index + 1 < capped.shown.length) {
      setIndex((value) => value + 1);
      setTip("");
      return;
    }
    if (capped.extra > 0 && !summary) {
      setSummary(true);
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

  if (!released || !queueKey) return null;
  if (summary && capped.extra > 0) {
    return (
      <div
        className="badge-unlock-backdrop fixed inset-0 z-[90] flex items-center justify-center overflow-hidden px-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-unlock-more"
        data-badge-unlock="more"
      >
        <div className="relative w-full max-w-sm text-center text-white">
          <p className="font-display text-4xl uppercase tracking-wide text-[#cbf805]" id="badge-unlock-more">
            {unlockMoreLine(capped.extra)}
          </p>
          <p className="mt-3 text-sm text-white/70">Saved to Progress → Badges.</p>
          <button
            type="button"
            onClick={keepGoing}
            className="touch-target mt-6 w-full rounded-full border border-white/40 text-white"
          >
            Keep going
          </button>
        </div>
      </div>
    );
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
      <div className="relative w-full max-w-sm text-center text-white">
        <div
          className={`badge-unlock-stage relative mx-auto flex h-[320px] w-[320px] items-center justify-center ${
            reduce ? "" : "badge-unlock-shake"
          }`}
        >
          <BadgeSparks key={current.id} active={!reduce} delayMs={700} />
          <div className={reduce ? "badge-unlock-fade" : "badge-unlock-fly"}>
            <div className="relative">
              <BadgeMark badge={badge} unit={unit} hero motion={false} />
            </div>
          </div>
        </div>
        <div className={reduce ? "" : "badge-unlock-copy"}>
          <p className="font-display inline-flex rounded-full bg-accent px-3 py-1 text-[11px] uppercase tracking-wide text-black">
            {categoryLabel}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/70">Badge unlocked</p>
          <h2 id="badge-unlock-title" className="badge-unlock-title font-display mt-2 text-4xl uppercase tracking-wide">
            {current.title}
          </h2>
          <p className="mt-2 text-sm text-white/55">{current.hint}</p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void onShare()}
              disabled={sharing}
              className="badge-unlock-share touch-target w-full rounded-full disabled:opacity-60"
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
