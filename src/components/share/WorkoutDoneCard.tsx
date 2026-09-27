"use client";

import { useMemo, useState } from "react";
import {
  SHARE_CARD_APP_LINK,
  SHARE_CARD_STYLES,
  type ShareCardStyle,
  type ShareStat,
} from "@/lib/share-card";
import { downloadShareCard, renderShareCardBlob, shareOrDownloadCard } from "@/lib/share-card-render";

const STYLE_LABEL: Record<ShareCardStyle, string> = {
  photo: "Photo",
  black: "Black",
  lime: "Lime",
};

export function WorkoutDoneCard({
  title,
  stats,
}: {
  title: string;
  stats: ShareStat[];
}) {
  const [style, setStyle] = useState<ShareCardStyle>("photo");
  const [pending, setPending] = useState<"share" | "save" | null>(null);
  const [tip, setTip] = useState("");
  const preview = useMemo(() => ({ title, stats, style }), [title, stats, style]);

  async function makeBlob() {
    return renderShareCardBlob(preview);
  }

  async function onShare() {
    setPending("share");
    setTip("");
    try {
      const blob = await makeBlob();
      const result = await shareOrDownloadCard(blob, shareFilename(title, style));
      if (result === "downloaded") {
        setTip("Image saved. Open Instagram and add it to your story.");
      }
    } catch {
      setTip("Could not share. Try Save image.");
    } finally {
      setPending(null);
    }
  }

  async function onSave() {
    setPending("save");
    setTip("");
    try {
      const blob = await makeBlob();
      await downloadShareCard(blob, shareFilename(title, style));
    } catch {
      setTip("Could not save the image.");
    } finally {
      setPending(null);
    }
  }

  const workTheme = style !== "lime";
  const ink = workTheme ? "text-white" : "text-black";

  return (
    <div className="space-y-3">
      <article
        className={`mx-auto w-full max-w-[15rem] overflow-hidden rounded-[1.75rem] ${
          style === "lime" ? "bg-accent text-black" : "bg-black text-white"
        }`}
      >
        <div
          className="relative aspect-[9/16] px-3 py-5"
          style={
            style === "photo"
              ? {
                  backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.35)), url(/tiles/train.webp)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-2 border-accent">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/svg-performance-badge.webp"
              alt=""
              className="h-14 w-14 rounded-full object-contain"
            />
          </div>
          <p
            className={`font-display mt-5 text-center text-xs uppercase tracking-[0.14em] ${
              style === "lime" ? "text-black" : "text-highlighter"
            }`}
          >
            Workout complete
          </p>
          <h2 className={`mt-2 text-center text-3xl leading-tight ${ink}`}>{title}</h2>
          <dl className="mt-5 grid grid-cols-2 gap-2">
            {stats.map((stat) => (
              <div key={stat.key} className="rounded-2xl bg-black/20 px-3 py-4 text-center">
                <dt className="font-display text-[11px] uppercase tracking-[0.1em] opacity-70">
                  {stat.label}
                </dt>
                <dd className="stat-display mt-1 text-2xl">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <p className="font-display mt-5 text-center text-xs uppercase tracking-[0.12em]">
            SVG Performance
          </p>
          <p className="mt-2 text-center text-xs opacity-70">{SHARE_CARD_APP_LINK}</p>
        </div>
      </article>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-sm text-muted">Card style</span>
        {SHARE_CARD_STYLES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStyle(item)}
            className={`touch-target rounded-full px-4 text-sm ${
              style === item ? "bg-accent text-black" : "border border-line"
            }`}
          >
            {STYLE_LABEL[item]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void onShare()}
        disabled={pending !== null}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending === "share" ? "Preparing…" : "Share to Instagram story"}
      </button>
      <button
        type="button"
        onClick={() => void onSave()}
        disabled={pending !== null}
        className="touch-target w-full rounded-full border border-line"
      >
        {pending === "save" ? "Saving…" : "Save image"}
      </button>
      {tip ? <p className="text-center text-sm text-muted">{tip}</p> : null}
    </div>
  );
}

function shareFilename(title: string, style: ShareCardStyle) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workout";
  return `svg-performance-${slug}-${style}.png`;
}
