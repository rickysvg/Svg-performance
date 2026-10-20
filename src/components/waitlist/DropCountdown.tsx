"use client";

import { useEffect, useState } from "react";

const UNITS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Sec" },
] as const;

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function DropCountdown({ dropAt }: { dropAt: string }) {
  const target = new Date(dropAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const left = now == null ? null : parts(target - now);
  const live = left != null && target - now <= 0;

  return (
    <section className="hc-panel hc-carbon px-4 py-4" aria-label="Countdown to Nov 16" data-drop-countdown>
      <div className="flex items-center justify-between gap-3">
        <p className="hc-kicker">Until Nov 16</p>
        <p className="font-telemetry text-[10px] uppercase tracking-[0.16em] text-muted">Denver</p>
      </div>
      {live ? (
        <p className="mt-4 font-display text-4xl text-[#CBF805]">Drop day</p>
      ) : (
        <ol className="mt-4 grid grid-cols-4 gap-2">
          {UNITS.map((unit) => (
            <li key={unit.key} className="border border-[#cbf805]/25 bg-black/45 px-2 py-3 text-center">
              <p className="font-telemetry text-2xl leading-none text-[#CBF805]">
                {left ? String(left[unit.key]).padStart(2, "0") : "—"}
              </p>
              <p className="mt-2 font-telemetry text-[10px] uppercase tracking-[0.14em] text-muted">
                {unit.label}
              </p>
              {unit.key === "days" ? <span className="mx-auto mt-2 block h-0.5 w-6 bg-signal" /> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
