import Link from "next/link";
import type { getTodayGuide } from "@/lib/today";
import { bikeLoggerHref } from "@/lib/timer-session";
import {
  estimateSessionMinutes,
  exerciseCountLabel,
} from "@/lib/exercise-media";
import { SectionHeading } from "@/components/home/SectionHeading";
import { WeekStrip } from "@/components/training/WeekStrip";
import { SparringLogForm } from "@/components/training/SparringLogForm";

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
  startHref,
  resumeLabel = "Resume",
  startLabel = "Start",
}: {
  dayId?: string;
  draftId?: string;
  startHref?: string;
  resumeLabel?: string;
  startLabel?: string;
}) {
  if (draftId) {
    return (
      <Link
        href={`/training/log/${draftId}`}
        data-prime-coach-audio
        className="touch-target mt-6 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
      >
        {resumeLabel}
      </Link>
    );
  }
  if (dayId) {
    return (
      <Link
        href={startHref ?? bikeLoggerHref(dayId)}
        prefetch={false}
        data-prime-coach-audio
        className="touch-target mt-6 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
      >
        {startLabel}
      </Link>
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
  const next = today.nextSession;

  return (
    <section className="space-y-4">
      <SectionHeading title="Today’s plan" href="/training" className="pr-16" />
      {today.mesoLabel ? (
        <p className="font-display text-xs uppercase tracking-wide text-accent">{today.mesoLabel}</p>
      ) : null}
      <p className="text-sm">
        <Link href="/timer" className="font-semibold text-accent underline-offset-4 hover:underline">
          Round timer
        </Link>
        <span className="text-muted"> — bag, pads, or sparring rounds</span>
      </p>
      {today.weekStrip?.length ? <WeekStrip days={today.weekStrip} /> : null}
      {today.dayNote ? <p className="text-sm text-muted">{today.dayNote}</p> : null}
      {today.outsideKind === "sparring" ? (
        <SparringLogForm
          dateKey={today.weekStrip.find((day) => day.isSelected)?.dayParam ?? ""}
          weekday={today.planWeekday}
          timeLabel={today.outsideLabel.replace(/^Sparring\s*·\s*/, "")}
          saved={today.sparringLog}
        />
      ) : null}
      {today.outsideKind === "sparring" ? null : workoutSessions.length === 0 ? (
        <div className="rounded-[2rem] bg-black px-5 py-6 text-white">
          <p className="font-display text-xs uppercase tracking-[0.06em] text-highlighter">
            {today.planWeekday || "Training"} · Rest
          </p>
          <h3 className="mt-3 text-2xl leading-tight">REST DAY</h3>
          <p className="mt-2 text-sm text-white/70">
            {today.nextSessionWeekday
              ? `Recover today. Next session: ${today.nextSessionWeekday}.`
              : "Recover today."}
          </p>
          <SessionCta
            dayId={next?.dayId}
            startHref={next?.startHref}
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
                  startHref={session.startHref}
                  draftId={draft ? today.draft?.id : undefined}
                />
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
