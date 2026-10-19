import Link from "next/link";
import { SummaryReader } from "@/components/home/SummaryReader";
import type { DaySummaryFacts, SummarySessionKind } from "@/lib/coach/day-summary";

const KIND_LABEL: Record<SummarySessionKind, string> = {
  lift: "Strength",
  bag: "Bag",
  cardio: "Conditioning",
  mobility: "Mobility",
  sparring: "Sparring",
  rest: "Rest",
};

export function TodaySummaryView({
  facts,
  script,
  circle,
  when,
  readAloudsLeft = 1,
  blockedReason = "read_aloud",
}: {
  facts: DaySummaryFacts;
  script: string;
  circle: string;
  when: string;
  readAloudsLeft?: number;
  blockedReason?: "read_aloud" | "ai_daily_cap";
}) {
  return (
    <main className="space-y-5 pb-8" data-today-summary-page>
      <Link href="/home" className="text-sm text-muted">
        Home
      </Link>
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={circle}
          alt=""
          width={512}
          height={512}
          className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-accent"
        />
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Today&apos;s summary</p>
          <h1 className="text-2xl">Coach {facts.coachName}</h1>
          <p className="text-sm text-muted" data-summary-when>
            {when}
            {facts.dayKind === "rest"
              ? " · rest"
              : facts.dayKind === "sparring"
                ? " · sparring"
                : ""}
          </p>
        </div>
      </header>

      <SummaryReader
        script={script}
        coachId={facts.coachId}
        readAloudsLeft={readAloudsLeft}
        blockedReason={blockedReason}
      />

      <section className="space-y-3">
        {facts.sessions.map((session) => (
          <article
            key={`${session.kind}-${session.title}`}
            data-summary-session={session.kind}
            className="rounded-2xl border border-line bg-card px-4 py-4"
          >
            <p className="text-xs uppercase tracking-wide text-muted">{KIND_LABEL[session.kind]}</p>
            <h2 className="mt-1 text-lg">{session.title}</h2>
            <div className="relative mt-3">
              <ul
                data-summary-chips
                className="flex gap-2 overflow-x-auto pb-1 pr-8"
              >
                {(session.lines.length ? session.lines : session.cues).map((line) => (
                  <li
                    key={line}
                    className="shrink-0 rounded-full border border-line bg-background px-3 py-1 text-sm whitespace-nowrap"
                  >
                    {line}
                  </li>
                ))}
              </ul>
              <div
                aria-hidden
                data-chip-fade
                className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent"
              />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
