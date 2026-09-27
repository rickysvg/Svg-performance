"use client";

import { useEffect, useRef } from "react";
import type { BadgeStyleId } from "@/lib/badge-style";

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

function rimPoint(style: BadgeStyleId, cx: number, cy: number, radius: number, angle: number) {
  if (style === "belt") {
    return {
      x: cx + Math.cos(angle) * radius * 1.12,
      y: cy + Math.sin(angle) * radius * 0.7,
    };
  }
  if (style === "hex") {
    const step = Math.PI / 3;
    const sector = Math.floor((((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / step);
    const a0 = -Math.PI / 2 + sector * step;
    const a1 = a0 + step;
    const t = ((((angle + Math.PI / 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / step - sector;
    const x0 = cx + Math.cos(a0) * radius;
    const y0 = cy + Math.sin(a0) * radius;
    const x1 = cx + Math.cos(a1) * radius;
    const y1 = cy + Math.sin(a1) * radius;
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
  }
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

export function BadgeSparks({
  active,
  style = "medal",
  durationMs = 2400,
}: {
  active: boolean;
  style?: BadgeStyleId;
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
      const cy = style === "hex" ? h * 0.42 : h / 2;
      const radius = style === "belt" ? Math.min(w, h) * 0.34 : Math.min(w, h) * 0.36;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const origin = rimPoint(style, cx, cy, radius, angle);
        const speed = 0.7 + Math.random() * 2.4;
        const hot = Math.random() > 0.78;
        sparks.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.85 + 0.15,
          life: 1,
          max: 260 + Math.random() * 280,
          size: hot ? 1.6 + Math.random() : 1.1 + Math.random() * 1.3,
          streak: Math.random() > 0.35,
          hot,
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
        spawn(elapsed < 280 ? 7 : elapsed < 900 ? 3 : 1);
      }
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i]!;
        spark.vy += 0.2;
        spark.vx *= 0.984;
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.life -= 16 / spark.max;
        if (spark.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(spark.life, 0);
        ctx.strokeStyle = spark.hot ? "#ffffff" : "#E8FF4A";
        ctx.fillStyle = spark.hot ? "#ffffff" : "#CBF805";
        ctx.shadowColor = spark.hot ? "#ffffff" : "#CBF805";
        ctx.shadowBlur = spark.hot ? 6 : 4;
        ctx.lineWidth = spark.size;
        ctx.lineCap = "round";
        if (spark.streak) {
          ctx.beginPath();
          ctx.moveTo(spark.x, spark.y);
          ctx.lineTo(spark.x - spark.vx * 3.1, spark.y - spark.vy * 3.1);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      if (elapsed < durationMs + 500 || sparks.length > 0) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [active, durationMs, style]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    />
  );
}
