import Link from "next/link";
import { SummaryReader } from "@/components/home/SummaryReader";
import type { DaySummaryFacts, SummaryDayProgress, SummarySessionKind } from "@/lib/coach/day-summary";

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
  progress = null,
}: {
  facts: DaySummaryFacts;
  script: string;
  circle: string;
  when: string;
  readAloudsLeft?: number;
  progress?: SummaryDayProgress | null;
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

      <p data-summary-script className="text-sm leading-relaxed">
        {script}
      </p>
      {progress ? (
        <section data-summary-progress className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted">Logged today</p>
          <p className="mt-1 font-semibold">{progress.label}</p>
        </section>
      ) : null}
      <SummaryReader script={script} coachId={facts.coachId} readAloudsLeft={readAloudsLeft} />

      <section className="space-y-3">
        {facts.sessions.map((session) => (
          <article
            key={`${session.kind}-${session.title}`}
            data-summary-session={session.kind}
            className="rounded-2xl border border-line bg-card px-4 py-4"
          >
            <p className="text-xs uppercase tracking-wide text-muted">{KIND_LABEL[session.kind]}</p>
            <h2 className="mt-1 text-lg">{session.title}</h2>
            <ul data-summary-chips className="mt-3 flex flex-wrap gap-2">
              {(session.lines.length ? session.lines : session.cues).map((line) => (
                <li
                  key={line}
                  className="rounded-full border border-line bg-background px-3 py-1 text-sm"
                >
                  {line}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
