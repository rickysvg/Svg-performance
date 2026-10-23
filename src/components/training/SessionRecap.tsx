import type { SessionSummary } from "@/lib/session-summary";

export function SessionRecap({ summary }: { summary: SessionSummary }) {
  return (
    <section
      data-session-summary={summary.kind}
      className="mt-4 w-full rounded-2xl border border-white/15 bg-black px-4 py-3 text-left"
    >
      <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[#CBF805]" data-session-when>
        {summary.whenLabel ?? "Today"}
      </p>
      <p className="mt-1 text-sm leading-snug text-white">{summary.goal}</p>
      <p className="mt-3 font-display text-[11px] uppercase tracking-[0.16em] text-white/55">Targeted</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {summary.targets.map((tag) => (
          <li
            key={tag}
            className="rounded-full border border-[#CBF805]/50 px-2 py-0.5 text-[11px] leading-4 text-[#CBF805]"
          >
            {tag}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-snug text-white/75">{summary.payoff}</p>
    </section>
  );
}
