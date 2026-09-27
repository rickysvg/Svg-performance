import Link from "next/link";
import { ProPill } from "@/components/pro/ProPill";
import type { CampSnapshot } from "@/lib/fight-camp";

export function ProTools({
  camp,
  formChecksLeft,
  formCheckLimit,
  unseenFormChecks,
  locked,
}: {
  camp: CampSnapshot | null;
  formChecksLeft: number;
  formCheckLimit: number;
  unseenFormChecks: number;
  locked: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xs uppercase tracking-[0.08em] text-muted">Performance</h2>
      {camp && !locked ? <CampFocusCard camp={camp} /> : <FightCampTeaser locked={locked} />}
      <Link
        href="/form-check"
        className="flex items-start justify-between gap-3 rounded-[1.5rem] border border-line bg-card px-4 py-4"
      >
        <span>
          <span className="flex items-center gap-2">
            <span className="font-display text-xl uppercase tracking-wide">Form check</span>
            <ProPill />
            {unseenFormChecks > 0 ? (
              <span
                className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-black"
                aria-label={`${unseenFormChecks} new form check ${unseenFormChecks === 1 ? "note" : "notes"}`}
              >
                {unseenFormChecks}
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-sm text-muted">
            {locked
              ? "Two clips a month. A real coach replies, signed SVG Coach."
              : unseenFormChecks > 0
                ? "New feedback is in. Open it to read the note."
                : `${formChecksLeft} of ${formCheckLimit} checks left this month.`}
          </span>
        </span>
        <span aria-hidden className="mt-1 text-lg text-black">
          ›
        </span>
      </Link>
    </section>
  );
}

function FightCampTeaser({ locked }: { locked: boolean }) {
  return (
    <Link href="/fight-camp" className="block rounded-[1.5rem] border border-line bg-white px-4 py-4">
      <span className="flex items-center gap-2">
        <span className="font-display text-xl uppercase tracking-wide">Fight camp</span>
        <ProPill />
      </span>
      <span className="mt-1 block text-sm text-muted">
        {locked
          ? "Week-by-week camp from your fight date. Performance."
          : "Set a fight date. We build a 12, 8, or 6 week camp."}
      </span>
    </Link>
  );
}

function CampFocusCard({ camp }: { camp: CampSnapshot }) {
  const headline =
    camp.phase === "complete"
      ? "Fight day has passed"
      : camp.phase === "pre-camp"
        ? `${camp.daysUntilCamp} day${camp.daysUntilCamp === 1 ? "" : "s"} until camp`
        : camp.daysToFight === 0
          ? "Fight day"
          : `${camp.daysToFight} day${camp.daysToFight === 1 ? "" : "s"} to fight`;

  const meta = [
    camp.fightDateLabel,
    camp.disciplineLabel,
    camp.weightClass,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href="/fight-camp" className="block rounded-[1.75rem] bg-black px-5 py-5 text-white">
      <span className="flex items-center gap-2">
        <span className="font-display text-xs uppercase tracking-[0.12em] text-highlighter">Fight camp</span>
        <ProPill />
      </span>
      <span className="mt-2 block font-display text-4xl uppercase leading-none tracking-wide text-highlighter">
        {headline}
      </span>
      <span className="mt-2 block text-sm text-white/80">{meta}</span>
      {camp.weekNumber ? (
        <span className="mt-3 block text-sm">
          Week {camp.weekNumber} of {camp.templateWeeks} · {camp.phaseLabel}
        </span>
      ) : (
        <span className="mt-3 block text-sm">{camp.phaseLabel}</span>
      )}
      <span className="mt-2 block text-sm text-white/80">{camp.todayFocus}</span>
    </Link>
  );
}
