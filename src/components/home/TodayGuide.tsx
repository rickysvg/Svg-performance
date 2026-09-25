import Link from "next/link";
import type { getTodayGuide } from "@/lib/today";
import { startSessionAction } from "@/app/actions/workouts";
import {
  estimateSessionMinutes,
  exerciseCountLabel,
} from "@/lib/exercise-media";
import { SectionHeading } from "@/components/home/SectionHeading";
import { WeekStrip } from "@/components/training/WeekStrip";

type Guide = Awaited<ReturnType<typeof getTodayGuide>>;

const KIND_LABEL = {
  skill: "Skill",
  strength: "Strength",
  conditioning: "Conditioning",
  rest: "Rest",
  mobility: "Recovery",
} as const;

function SessionCta({
  dayId,
  draftId,
  resumeLabel = "Resume",
  startLabel = "Start",
}: {
  dayId?: string;
  draftId?: string;
  resumeLabel?: string;
  startLabel?: string;
}) {
  if (draftId) {
    return (
      <Link
        href={`/training/log/${draftId}`}
        className="touch-target mt-6 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
      >
        {resumeLabel}
      </Link>
    );
  }
  if (dayId) {
    return (
      <form action={startSessionAction} className="mt-6">
        <input type="hidden" name="programDayId" value={dayId} />
        <button
          type="submit"
          className="touch-target inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
        >
          {startLabel}
        </button>
      </form>
    );
  }
  return (
    <Link
      href="/training"
      className="touch-target mt-6 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
    >
      Open Train
    </Link>
  );
}

export function TodayGuide({ guide }: { guide: Guide }) {
  const { today } = guide;
  const planned = today.plannedSessions ?? [];
  const workoutSessions = planned.filter((session) => session.href);
  const restOnly = planned.length > 0 && workoutSessions.length === 0;
  const next = today.nextSession;

  return (
    <section className="space-y-4">
      <SectionHeading title="Today’s plan" href="/training" className="pr-16" />
      {today.weekStrip?.length ? <WeekStrip days={today.weekStrip} /> : null}
      {restOnly ? (
        <div className="rounded-[2rem] bg-black px-5 py-6 text-white">
          <p className="font-display text-xs uppercase tracking-[0.06em] text-highlighter">
            {today.planWeekday || "Training"} · {today.planSummary || "Rest"}
          </p>
          <h3 className="mt-3 text-2xl leading-tight">
            {planned[0]?.title ?? "Rest day"}
          </h3>
          <p className="mt-2 text-sm text-white/70">
            {next
              ? `Next up ${today.nextSessionWeekday}: ${next.title}`
              : (planned[0]?.subtitle ?? today.suggestionCopy)}
          </p>
          <SessionCta
            dayId={next?.dayId}
            draftId={
              next?.dayId && today.draft?.programDayId === next.dayId
                ? today.draft.id
                : undefined
            }
            startLabel={next ? "Start next session" : "Open Train"}
            resumeLabel="Resume next session"
          />
        </div>
      ) : workoutSessions.length > 0 ? (
        <div className="space-y-3">
          {workoutSessions.map((session) => {
            const minutes = session.day ? estimateSessionMinutes(session.day.exercises) : 0;
            const count = session.day?.exercises.length ?? 0;
            const draft = today.draft && today.draft.programDayId === session.dayId;
            return (
              <article
                key={`${session.slot}-${session.dayId ?? session.label}`}
                className="rounded-[2rem] bg-black px-5 py-6 text-white"
              >
                <p className="font-display text-xs uppercase tracking-[0.06em] text-highlighter">
                  Session {session.slot} · {KIND_LABEL[session.kind]}
                  {minutes > 0 ? ` · est. ${minutes} min` : ""}
                </p>
                <h3 className="mt-3 text-2xl leading-tight">{session.title}</h3>
                <p className="mt-2 text-sm text-white/70">
                  {session.label}
                  {count > 0 ? ` · ${exerciseCountLabel(count)}` : ""}
                </p>
                <SessionCta
                  dayId={session.dayId}
                  draftId={draft ? today.draft?.id : undefined}
                />
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[2rem] bg-black px-5 py-6 text-white">
          <p className="font-display text-xs uppercase tracking-[0.06em] text-highlighter">
            Training
          </p>
          <h3 className="mt-3 text-2xl leading-tight">No DEMO day loaded</h3>
          <p className="mt-2 text-sm text-white/70">{today.suggestionCopy}</p>
          <Link
            href="/training"
            className="touch-target mt-6 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
          >
            Open Train
          </Link>
        </div>
      )}
    </section>
  );
}
