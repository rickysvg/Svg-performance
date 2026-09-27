"use client";

import { useEffect, useRef } from "react";
import {
  FX_CLIPS,
  FX_MAX_PX,
  frameIndexAt,
  fxSheetSrcs,
  fxStillPlaying,
  type FxClip,
  type FxClipName,
} from "@/lib/fx-clips";

const sheetCache = new Map<string, HTMLImageElement>();
const sheetWaiters = new Map<string, Promise<HTMLImageElement | null>>();

function loadSheet(src: string) {
  const hit = sheetCache.get(src);
  if (hit) return Promise.resolve(hit);
  const pending = sheetWaiters.get(src);
  if (pending) return pending;
  const next = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      sheetCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  sheetWaiters.set(src, next);
  return next;
}

export function preloadFxSheets() {
  return Promise.all(fxSheetSrcs().map((src) => loadSheet(src)));
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SpriteFx({
  name,
  active,
  delayMs = 0,
  size = FX_MAX_PX,
  className = "",
  holdLast = false,
}: {
  name: FxClipName;
  active: boolean;
  delayMs?: number;
  size?: number;
  className?: string;
  holdLast?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clip: FxClip = FX_CLIPS[name];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active || prefersReducedMotion()) return;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;
    let raf = 0;
    let running = true;
    let started = 0;
    let img: HTMLImageElement | null = null;

    const paint = (frame: number) => {
      const css = Math.min(size, FX_MAX_PX);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(css * dpr) || canvas.height !== Math.floor(css * dpr)) {
        canvas.width = Math.floor(css * dpr);
        canvas.height = Math.floor(css * dpr);
        canvas.style.width = `${css}px`;
        canvas.style.height = `${css}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, css, css);
      if (!img) return;
      const col = frame % clip.columns;
      const row = Math.floor(frame / clip.columns);
      ctx.drawImage(
        img,
        col * clip.frameSize,
        row * clip.frameSize,
        clip.frameSize,
        clip.frameSize,
        0,
        0,
        css,
        css,
      );
    };

    const tick = (now: number) => {
      if (!running) return;
      if (!started) started = now;
      const elapsed = now - started - delayMs;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      paint(frameIndexAt(clip, elapsed));
      if (clip.loop || fxStillPlaying(clip, elapsed) || holdLast) {
        raf = requestAnimationFrame(tick);
      }
    };

    void loadSheet(clip.sheet).then((sheet) => {
      if (!running) return;
      img = sheet;
      raf = requestAnimationFrame(tick);
    });

    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [active, clip, delayMs, holdLast, size]);

  if (!active) return null;
  const css = Math.min(size, FX_MAX_PX);
  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fx-sprite ${className}`}
      data-fx={name}
      width={css}
      height={css}
      aria-hidden
    />
  );
}

export function CelebrationFx({
  active,
  delayMs = 700,
  drift = false,
  size = FX_MAX_PX,
}: {
  active: boolean;
  delayMs?: number;
  drift?: boolean;
  size?: number;
}) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-fx-layer="1" aria-hidden>
      {drift ? (
        <SpriteFx name="ember_drift" active delayMs={0} size={size} className="fx-sprite-center" />
      ) : null}
      <SpriteFx name="star_flash" active delayMs={delayMs} size={Math.round(size * 0.72)} className="fx-sprite-center" />
      <SpriteFx
        name="ring_comet"
        active
        delayMs={delayMs}
        size={size}
        holdLast
        className="fx-sprite-center"
      />
      <SpriteFx name="ember_burst" active delayMs={delayMs} size={size} className="fx-sprite-center" />
    </div>
  );
}
