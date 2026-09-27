import Link from "next/link";
import { TRAVEL_CIRCUIT, TRAVEL_CREDITS, TRAVEL_KB } from "@/lib/travel-day";

export default function TravelDayPage() {
  return (
    <main className="space-y-6">
      <Link href="/training" className="text-sm font-semibold text-accent">
        Train
      </Link>
      <div>
        <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">Optional</p>
        <h1 className="mt-1 text-3xl">No gym / travel</h1>
        <p className="mt-2 text-sm text-muted">
          Use this when you are away from the gym. It does not replace Monday through Friday unless you choose it.
        </p>
      </div>
      <section className="space-y-3 rounded-[1.5rem] bg-black px-5 py-5 text-white">
        <h2 className="text-2xl text-white">Kettlebell</h2>
        <ul className="space-y-3">
          {TRAVEL_KB.map((block) => (
            <li key={block.name}>
              <p className="font-semibold">{block.name}</p>
              <p className="text-sm text-highlighter">{block.prescription}</p>
              <p className="mt-1 text-sm text-white/80">{block.cues}</p>
            </li>
          ))}
        </ul>
        <Link href="/timer" className="mt-2 inline-block text-sm text-accent">
          Open the round timer for the swing sets
        </Link>
      </section>
      <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-lg">No kettlebell</h2>
        <ul className="space-y-3 text-sm">
          {TRAVEL_CIRCUIT.map((block) => (
            <li key={block.name}>
              <p className="font-semibold">
                {block.name} · {block.prescription}
              </p>
              <p className="text-muted">{block.cues}</p>
            </li>
          ))}
        </ul>
      </section>
      <ul className="space-y-1 text-xs text-muted">
        {TRAVEL_CREDITS.map((credit) => (
          <li key={credit.url}>
            Inspired by {credit.coach} — {credit.idea}.{" "}
            <a href={credit.url} className="underline" target="_blank" rel="noreferrer">
              Their page
            </a>
            . Not their program.
          </li>
        ))}
      </ul>
    </main>
  );
}
