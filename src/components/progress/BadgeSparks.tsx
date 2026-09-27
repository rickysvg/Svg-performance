"use client";

import { useEffect, useRef } from "react";
import { PLATE_OUTLINE_POINTS } from "@/lib/plate-outline";

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  bounce: number;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sparkColor(life: number) {
  if (life > 0.72) return { stroke: "#ffffff", fill: "#fff6d0" };
  if (life > 0.42) return { stroke: "#ffd36a", fill: "#ffe38a" };
  return { stroke: "#CBF805", fill: "#E8FF4A" };
}

export function BadgeSparks({
  active,
  delayMs = 900,
  durationMs = 2100,
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

    const spawn = (count: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const plateW = w * (240 / 360);
      const plateH = plateW * (464 / 512);
      const left = (w - plateW) / 2;
      const top = (h - plateH) / 2;
      const cx = w / 2;
      const cy = h / 2;
      for (let i = 0; i < count; i += 1) {
        const [nx, ny] = PLATE_OUTLINE_POINTS[Math.floor(Math.random() * PLATE_OUTLINE_POINTS.length)]!;
        const x = left + nx * plateW;
        const y = top + ny * plateH;
        const ox = x - cx;
        const oy = y - cy;
        const n = Math.hypot(ox, oy) || 1;
        const speed = 1.3 + Math.random() * 3.2;
        sparks.push({
          x,
          y,
          vx: (ox / n) * speed,
          vy: (oy / n) * speed * 0.75 - 0.3 - Math.random() * 1.4,
          life: 1,
          max: 360 + Math.random() * 380,
          size: 0.85 + Math.random() * 1.35,
          bounce: 0,
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
        spawn(after < 180 ? 10 : after < 700 ? 4 : 1);
      }
      const floor = h * 0.93;
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i]!;
        spark.vy += 0.16 * (dt / 16);
        spark.vx *= 0.987;
        spark.x += spark.vx * (dt / 16);
        spark.y += spark.vy * (dt / 16);
        if (spark.y > floor && spark.vy > 0 && spark.bounce < 2) {
          spark.y = floor;
          spark.vy *= -0.26 - Math.random() * 0.16;
          spark.vx += (Math.random() - 0.5) * 1.1;
          spark.bounce += 1;
        }
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
        ctx.lineTo(spark.x - spark.vx * 3.2, spark.y - spark.vy * 3.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (elapsed < delayMs + durationMs + 600 || sparks.length > 0) {
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
      className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    />
  );
}
