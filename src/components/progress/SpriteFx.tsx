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

function featherEdges(ctx: CanvasRenderingContext2D, css: number) {
  const fade = ctx.createRadialGradient(css / 2, css / 2, css * 0.28, css / 2, css / 2, css * 0.5);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(0.62, "rgba(0,0,0,0.85)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, css, css);
  ctx.globalCompositeOperation = "source-over";
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
      featherEdges(ctx, css);
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
      className={`pointer-events-none fx-sprite fx-feather ${className}`}
      data-fx={name}
      width={css}
      height={css}
      aria-hidden
    />
  );
}

type Ember = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  flicker: number;
};

function emberFill(life: number) {
  if (life > 0.72) return { core: "#ffffff", bloom: "rgba(255, 246, 200, 0.95)", rim: "rgba(255, 214, 80, 0.55)" };
  if (life > 0.4) return { core: "#fff4b0", bloom: "rgba(255, 214, 80, 0.7)", rim: "rgba(203, 248, 5, 0.45)" };
  return { core: "#CBF805", bloom: "rgba(203, 248, 5, 0.4)", rim: "rgba(203, 248, 5, 0.12)" };
}

/** Soft hot-core motes — no long stroke bars. */
export function EmberMotes({
  active,
  delayMs = 700,
  durationMs = 1400,
}: {
  active: boolean;
  delayMs?: number;
  durationMs?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active || prefersReducedMotion()) return;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;
    const motes: Ember[] = [];
    let raf = 0;
    let running = true;
    let started = 0;
    let last = 0;

    const resize = () => {
      const css = Math.min(canvas.clientWidth || 420, FX_MAX_PX);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(css * dpr);
      canvas.height = Math.floor(css * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (count: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.1 + Math.random() * 4.2;
        motes.push({
          x: cx + (Math.random() - 0.5) * 18,
          y: cy + (Math.random() - 0.5) * 18,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.72 - 1.1 - Math.random() * 2.4,
          life: 1,
          max: 380 + Math.random() * 720,
          size: 1.4 + Math.random() * 3.6,
          flicker: 0.7 + Math.random() * 0.6,
        });
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      if (!started) {
        started = now;
        last = now;
      }
      const dt = Math.min(24, now - last);
      last = now;
      const elapsed = now - started;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const after = elapsed - delayMs;
      if (after >= 0 && after < 220) spawn(after < 80 ? 14 : 7);
      else if (after >= 220 && after < durationMs && Math.random() < 0.35) spawn(2);
      for (let i = motes.length - 1; i >= 0; i -= 1) {
        const mote = motes[i]!;
        mote.vy += 0.16 * (dt / 16);
        mote.vx *= 0.986;
        mote.x += mote.vx * (dt / 16);
        mote.y += mote.vy * (dt / 16);
        mote.life -= dt / mote.max;
        if (mote.life <= 0) {
          motes.splice(i, 1);
          continue;
        }
        const pulse = 0.72 + 0.28 * Math.sin((now / 40) * mote.flicker);
        const alpha = Math.max(0, mote.life) * pulse;
        const color = emberFill(mote.life);
        const r = mote.size * (0.7 + mote.life * 0.6);
        const glow = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, r * 4.2);
        glow.addColorStop(0, color.core);
        glow.addColorStop(0.18, color.bloom);
        glow.addColorStop(0.55, color.rim);
        glow.addColorStop(1, "rgba(203, 248, 5, 0)");
        ctx.globalAlpha = alpha;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, r * 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color.core;
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, Math.max(0.6, r * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (elapsed < delayMs + durationMs + 500 || motes.length > 0) {
        raf = requestAnimationFrame(tick);
      }
    };

    resize();
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [active, delayMs, durationMs]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fx-sprite fx-feather fx-sprite-center h-[420px] w-[420px]"
      data-fx="ember-motes"
      aria-hidden
    />
  );
}

export function CelebrationFx({
  active,
  delayMs = 700,
  size = 720,
}: {
  active: boolean;
  delayMs?: number;
  drift?: boolean;
  size?: number;
}) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden fx-feather-layer" data-fx-layer="1" aria-hidden>
      <SpriteFx name="star_flash" active delayMs={delayMs} size={Math.round(size * 0.62)} className="fx-sprite-center" />
      <SpriteFx name="ember_burst" active delayMs={delayMs} size={size} className="fx-sprite-center" />
      <EmberMotes active delayMs={delayMs} />
    </div>
  );
}
