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
  streak: boolean;
  hot: boolean;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BadgeSparks({
  active,
  durationMs = 2400,
}: {
  active: boolean;
  durationMs?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active || prefersReducedMotion()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sparks: Spark[] = [];
    const started = performance.now();
    let raf = 0;
    let running = true;

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
      const cy = h * 0.38;
      const radius = Math.min(w, h) * 0.16;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.6 + Math.random() * 6.2;
        sparks.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius * 0.9,
          vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 1.4,
          vy: Math.sin(angle) * speed - Math.random() * 2.8,
          life: 1,
          max: 420 + Math.random() * 380,
          size: 1 + Math.random() * 2.4,
          streak: Math.random() > 0.45,
          hot: Math.random() > 0.7,
        });
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      const elapsed = now - started;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      if (elapsed < durationMs) {
        spawn(elapsed < 380 ? 14 : 5);
      }
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i]!;
        spark.vy += 0.11;
        spark.vx *= 0.992;
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.life -= 16 / spark.max;
        if (spark.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(spark.life, 0);
        ctx.strokeStyle = spark.hot ? "#ffffff" : "#CBF805";
        ctx.fillStyle = spark.hot ? "#fff6b0" : "#CBF805";
        ctx.lineWidth = spark.size;
        if (spark.streak) {
          ctx.beginPath();
          ctx.moveTo(spark.x, spark.y);
          ctx.lineTo(spark.x - spark.vx * 2.4, spark.y - spark.vy * 2.4);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
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
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
