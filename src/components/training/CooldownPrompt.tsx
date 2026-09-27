"use client";

import Link from "next/link";
import { useState } from "react";

export function CooldownPrompt() {
  const [skipped, setSkipped] = useState(false);
  if (skipped) {
    return (
      <p className="text-sm text-muted">Cooldown skipped. You can open it anytime from Mobility.</p>
    );
  }
  return (
    <section className="space-y-3 rounded-[1.75rem] border border-line bg-card p-5">
      <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">After training</p>
      <h2 className="text-2xl">Cooldown</h2>
      <p className="text-sm text-muted">
        About 8 minutes of easy holds. Static work belongs after the session. You can skip it.
      </p>
      <Link
        href="/mobility/cooldown/play"
        className="touch-target flex w-full items-center justify-center rounded-full bg-accent text-black"
      >
        Start cooldown
      </Link>
      <button
        type="button"
        onClick={() => setSkipped(true)}
        className="touch-target w-full rounded-full border border-black bg-white font-semibold"
      >
        Skip for now
      </button>
    </section>
  );
}
