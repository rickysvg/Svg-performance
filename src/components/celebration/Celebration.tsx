"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const CELEBRATION_COPY: Record<string, { title: string; body: string }> = {
  workout: {
    title: "Session saved",
    body: "That’s work in the book. Rate how it felt, then keep moving.",
  },
  lesson: {
    title: "Lesson complete",
    body: "Nice. Keep the notes honest and come back when you want the next one.",
  },
  streak: {
    title: "Another day this week",
    body: "You logged something new today. Consistency, not a punishment.",
  },
  photo: {
    title: "Photo saved",
    body: "Private to you. That’s a real check-in.",
  },
  clip: {
    title: "Coach notes are in",
    body: "Open the timestamps. Practice the drill. This is not a live stream.",
  },
  challenge: {
    title: "Challenge month complete",
    body: "You showed up enough days. Consistency, not heaviest lift.",
  },
  milestone: {
    title: "Milestone done",
    body: "That’s a DEMO path step in the book. Keep the next one honest.",
  },
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function burst(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const colors = ["#CBF805", "#0a0a0a", "#ffffff", "#8fbf00"];
  const particles = Array.from({ length: 42 }, () => ({
    x: canvas.width / 2,
    y: canvas.height * 0.35,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * -8 - 2,
    size: Math.random() * 5 + 2,
    color: colors[Math.floor(Math.random() * colors.length)] ?? "#CBF805",
    life: 1,
  }));
  let frame = 0;
  let raf = 0;
  const tick = () => {
    frame += 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.vy += 0.18;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.018;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
    }
    if (frame < 70) {
      raf = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function Celebration() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const kind = params.get("celebrate") ?? "";
  const copy = CELEBRATION_COPY[kind];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(Boolean(copy));
  const [seenCopy, setSeenCopy] = useState(copy);
  if (copy !== seenCopy) {
    setSeenCopy(copy);
    setVisible(Boolean(copy));
  }

  useEffect(() => {
    if (!copy || !visible) return;
    const canvas = canvasRef.current;
    const reduce = prefersReducedMotion();
    const stop = canvas && !reduce ? burst(canvas) : () => {};
    const hide = window.setTimeout(() => setVisible(false), 3200);
    const next = new URLSearchParams(params.toString());
    next.delete("celebrate");
    const qs = next.toString();
    const clear = window.setTimeout(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 500);
    return () => {
      stop();
      window.clearTimeout(hide);
      window.clearTimeout(clear);
    };
  }, [copy, visible, params, pathname, router]);

  if (!copy || !visible) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center px-4 pt-20"
      role="status"
      aria-live="polite"
    >
      <canvas
        ref={canvasRef}
        width={390}
        height={520}
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto"
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-accent/50 bg-card/95 px-5 py-4 shadow-lg">
        <p className="font-display text-xs uppercase tracking-wide text-accent">Nice work</p>
        <p className="font-display mt-1 text-lg uppercase tracking-wide">{copy.title}</p>
        <p className="mt-1 text-sm text-muted">{copy.body}</p>
      </div>
    </div>
  );
}
