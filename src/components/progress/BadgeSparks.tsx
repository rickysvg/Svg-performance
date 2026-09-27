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
  bounce: number;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function plateRim(cx: number, cy: number, rx: number, ry: number, angle: number) {
  return {
    x: cx + Math.cos(angle) * rx,
    y: cy + Math.sin(angle) * ry,
  };
}

function sparkColor(life: number) {
  if (life > 0.72) return { stroke: "#ffffff", fill: "#fff6d0" };
  if (life > 0.42) return { stroke: "#ffd36a", fill: "#ffe38a" };
  return { stroke: "#CBF805", fill: "#E8FF4A" };
}

export function BadgeSparks({
  active,
  durationMs = 2600,
}: {
  active: boolean;
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
      const cx = w / 2;
      const cy = h * 0.46;
      const rx = Math.min(w, h) * 0.36;
      const ry = Math.min(w, h) * 0.28;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const origin = plateRim(cx, cy, rx, ry, angle);
        const speed = 1.4 + Math.random() * 3.6;
        sparks.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed * (0.7 + Math.random() * 0.5),
          vy: Math.sin(angle) * speed * 0.7 - 0.4 - Math.random() * 1.6,
          life: 1,
          max: 380 + Math.random() * 420,
          size: 0.9 + Math.random() * 1.5,
          bounce: 0,
        });
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(32, now - last);
      last = now;
      const elapsed = now - started;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      if (elapsed < durationMs) {
        spawn(elapsed < 220 ? 16 : elapsed < 900 ? 5 : 2);
      }
      const floor = h * 0.92;
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i]!;
        spark.vy += 0.16 * (dt / 16);
        spark.vx *= 0.987;
        spark.x += spark.vx * (dt / 16);
        spark.y += spark.vy * (dt / 16);
        if (spark.y > floor && spark.vy > 0 && spark.bounce < 2) {
          spark.y = floor;
          spark.vy *= -0.28 - Math.random() * 0.18;
          spark.vx += (Math.random() - 0.5) * 1.2;
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
        ctx.lineTo(spark.x - spark.vx * 3.4, spark.y - spark.vy * 3.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (elapsed < durationMs + 700 || sparks.length > 0) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [active, durationMs]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    />
  );
}
