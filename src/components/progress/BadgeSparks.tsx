"use client";

import { useEffect, useRef } from "react";

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sparkColor(life: number) {
  if (life > 0.7) return { stroke: "#ffffff", fill: "#fff6d0" };
  if (life > 0.4) return { stroke: "#ffe38a", fill: "#CBF805" };
  return { stroke: "#CBF805", fill: "#E8FF4A" };
}

function rimPoint(t: number, cx: number, cy: number, r: number) {
  const a = t * Math.PI * 2 - Math.PI / 2;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}

export function BadgeSparks({
  active,
  delayMs = 900,
  durationMs = 2200,
}: {
  active: boolean;
  delayMs?: number;
  durationMs?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active || prefersReducedMotion()) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const sparks: Spark[] = [];
    const started = performance.now();
    let raf = 0;
    let running = true;
    let last = started;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const spawn = (count: number, fromTip: boolean) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.34;
      const elapsed = performance.now() - started;
      const drawT = Math.min(1, Math.max(0, (elapsed - delayMs) / 320));
      for (let i = 0; i < count; i += 1) {
        const t = fromTip ? drawT : Math.random();
        const p = rimPoint(t, cx, cy, r);
        const ox = p.x - cx;
        const oy = p.y - cy;
        const n = Math.hypot(ox, oy) || 1;
        const speed = 2.2 + Math.random() * 5.4;
        sparks.push({
          x: p.x,
          y: p.y,
          vx: (ox / n) * speed + (Math.random() - 0.5) * 1.4,
          vy: (oy / n) * speed * 0.7 - 0.8 - Math.random() * 2.2,
          life: 1,
          max: 420 + Math.random() * 520,
          size: 1.1 + Math.random() * 2.1,
        });
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(22, now - last);
      last = now;
      const elapsed = now - started;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const after = elapsed - delayMs;
      if (after >= 0 && after < durationMs) {
        spawn(after < 280 ? 16 : after < 900 ? 6 : 2, after < 320);
      }
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i]!;
        spark.vy += 0.14 * (dt / 16);
        spark.vx *= 0.988;
        spark.x += spark.vx * (dt / 16);
        spark.y += spark.vy * (dt / 16);
        spark.life -= dt / spark.max;
        if (spark.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        const color = sparkColor(spark.life);
        ctx.globalAlpha = Math.max(spark.life, 0);
        ctx.strokeStyle = color.stroke;
        ctx.fillStyle = color.fill;
        ctx.lineWidth = spark.size;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(spark.x, spark.y);
        ctx.lineTo(spark.x - spark.vx * 4.4, spark.y - spark.vy * 4.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (elapsed < delayMs + durationMs + 700 || sparks.length > 0) {
        raf = requestAnimationFrame(tick);
      }
    };

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
      className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    />
  );
}
