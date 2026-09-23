import Link from "next/link";
import type { getTodayGuide } from "@/lib/today";
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

export function TodayGuide({ guide }: { guide: Guide }) {
  const { today } = guide;
  const planned = today.plannedSessions ?? [];
  const workoutSessions = planned.filter((session) => session.href);
  const restOnly = planned.length > 0 && workoutSessions.length === 0;

  return (
    <section className="space-y-4">
      <SectionHeading title="Today’s plan" href="/training" />
      {today.weekStrip?.length ? <WeekStrip days={today.weekStrip} /> : null}
      {restOnly ? (
        <div className="rounded-[2rem] bg-black px-5 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-highlighter">
            {today.planWeekday || "Training"} · {today.planSummary || "Rest"}
          </p>
          <h3 className="mt-3 text-2xl font-semibold leading-tight">
            {planned[0]?.title ?? "Rest day"}
          </h3>
          <p className="mt-2 text-sm text-white/70">
            {planned[0]?.subtitle ?? today.suggestionCopy}
          </p>
          <Link
            href="/training"
            className="touch-target mt-6 inline-flex items-center rounded-full bg-accent px-5 text-sm font-semibold text-black"
          >
            Open Train
          </Link>
        </div>
      ) : workoutSessions.length > 0 ? (
        <div className="space-y-3">
          {workoutSessions.map((session) => {
            const minutes = session.day ? estimateSessionMinutes(session.day.exercises) : 0;
            const count = session.day?.exercises.length ?? 0;
            const draft = today.draft && today.draft.programDayId === session.dayId;
            const href = draft
              ? `/training/log/${today.draft?.id}`
              : session.href ?? "/training";
            return (
              <Link
                key={`${session.slot}-${session.dayId ?? session.label}`}
                href={href}
                className="block rounded-[2rem] bg-black px-5 py-6 text-white"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-highlighter">
                  Session {session.slot} · {KIND_LABEL[session.kind]}
                  {minutes > 0 ? ` · est. ${minutes} min` : ""}
                </p>
                <h3 className="mt-3 text-2xl font-semibold leading-tight">{session.title}</h3>
                <p className="mt-2 text-sm text-white/70">
                  {session.label}
                  {count > 0 ? ` · ${exerciseCountLabel(count)}` : ""}
                </p>
                <span className="touch-target mt-6 inline-flex items-center rounded-full bg-accent px-5 text-sm font-semibold text-black">
                  {draft ? "Continue" : "Open session"}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[2rem] bg-black px-5 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-highlighter">
            Training
          </p>
          <h3 className="mt-3 text-2xl font-semibold leading-tight">No DEMO day loaded</h3>
          <p className="mt-2 text-sm text-white/70">{today.suggestionCopy}</p>
          <Link
            href="/training"
            className="touch-target mt-6 inline-flex items-center rounded-full bg-accent px-5 text-sm font-semibold text-black"
          >
            Open Train
          </Link>
        </div>
      )}
    </section>
  );
}
