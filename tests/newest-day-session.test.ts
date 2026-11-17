import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeToday } from "@/components/home/HomeToday";
import { PlanSessionCard } from "@/components/training/PlanSessionCard";
import { primaryTrainCta, startAgainHrefForDay } from "@/lib/train-cta";
import { newestDaySession, type ResumableLog } from "@/lib/today-start";

const zone = "America/Denver";
const day = "2026-11-17";
const liftExercises = [
  { name: "Goblet squat", sets: 4 },
  { name: "Row", sets: 3 },
];

function ticked(name = "Goblet squat") {
  return {
    exerciseName: name,
    completed: true,
    reps: 8,
    loadValue: 40,
    durationSeconds: null,
  };
}

function draftSet() {
  return {
    exerciseName: "Goblet squat",
    completed: false,
    reps: 5,
    loadValue: 40,
    durationSeconds: null,
  };
}

function log(partial: Partial<ResumableLog> & Pick<ResumableLog, "id" | "status" | "performedAt">): ResumableLog {
  return {
    programDayId: "lift",
    sets: [],
    programDay: { exercises: liftExercises },
    ...partial,
  };
}

const shortFinish = log({
  id: "sealed-short",
  status: "complete",
  performedAt: new Date("2026-11-17T15:00:00.000Z"),
  sets: [ticked()],
});

const fullFinish = log({
  id: "sealed-full",
  status: "complete",
  performedAt: new Date("2026-11-17T16:00:00.000Z"),
  plannedSetCount: 4,
  sets: [ticked(), ticked(), ticked(), ticked()],
  programDay: { exercises: [{ name: "Goblet squat", sets: 4 }] },
});

const savedDraft = log({
  id: "open-draft",
  status: "draft",
  performedAt: new Date("2026-11-17T18:00:00.000Z"),
  sets: [draftSet()],
});

const olderDraft = log({
  id: "older-draft",
  status: "draft",
  performedAt: new Date("2026-11-17T14:00:00.000Z"),
  sets: [draftSet()],
});

function faceOf(sessions: ResumableLog[]) {
  return newestDaySession(sessions, day, zone).get("lift");
}

function surfaces(sessions: ResumableLog[]) {
  const face = faceOf(sessions);
  const resume = face?.label === "resume";
  const done = face?.label === "done";
  const home = renderToStaticMarkup(
    createElement(HomeToday, {
      guide: {
        today: {
          plannedSessions: [
            { kind: "strength", title: "Lift 1", label: "Strength", dayId: "lift" },
          ],
          nextSession: null,
          nextSessionWeekday: "",
          completedDayIds: done ? ["lift"] : [],
          partialDayIds: resume && face?.partial ? ["lift"] : [],
          resumeByDay: resume
            ? {
                lift: {
                  id: face!.id,
                  partial: face!.partial,
                  ticked: face!.ticked,
                  planned: face!.planned,
                },
              }
            : {},
        },
      },
    } as never),
  );
  const again = done ? startAgainHrefForDay("lift", "/training/lift/start") : undefined;
  const card = renderToStaticMarkup(
    createElement(PlanSessionCard, {
      session: {
        slot: "A",
        kind: "strength",
        label: "Strength",
        title: "Lift 1",
        subtitle: "Squat",
        optional: false,
        dayId: "lift",
        href: "/training/lift",
        startHref: "/training/lift/start",
      },
      completed: done,
      resume: resume
        ? {
            id: face!.id,
            partial: face!.partial,
            ticked: face!.ticked,
            planned: face!.planned,
            progress: face!.progress,
          }
        : undefined,
      startAgainHref: again,
    }),
  );
  const today = primaryTrainCta({
    resumeHref: resume ? `/training/log/${face!.id}` : null,
    startHref: done ? null : "/training/lift/start",
    startAgainHref: again ?? null,
  });
  return { face, home, card, today };
}

describe("newest session decides Home, the day card, and Today", () => {
  it("shows Resume everywhere when a saved draft is newer than a finish", () => {
    const shown = surfaces([savedDraft, shortFinish]);
    expect(shown.face).toMatchObject({ id: "open-draft", label: "resume", partial: false });
    expect(shown.home).toContain("Resume");
    expect(shown.home).toContain("/training/log/open-draft");
    expect(shown.home).not.toContain("data-session-done");
    expect(shown.card).toContain("Resume");
    expect(shown.card).toContain("/training/log/open-draft");
    expect(shown.card).not.toContain("data-session-done");
    expect(shown.card).not.toContain("sealed-short");
    expect(shown.today).toEqual({ verb: "Resume", href: "/training/log/open-draft" });

    const afterFull = surfaces([
      { ...savedDraft, performedAt: new Date("2026-11-17T19:00:00.000Z") },
      fullFinish,
    ]);
    expect(afterFull.face).toMatchObject({ id: "open-draft", label: "resume" });
    expect(afterFull.today?.verb).toBe("Resume");
    expect(afterFull.home).not.toContain("data-session-done");
    expect(afterFull.card).not.toContain("data-session-done");
  });

  it("shows Done everywhere when a finish is newer than a draft", () => {
    const shown = surfaces([
      { ...shortFinish, performedAt: new Date("2026-11-17T20:00:00.000Z") },
      olderDraft,
    ]);
    expect(shown.face).toMatchObject({ id: "sealed-short", label: "done" });
    expect(shown.home).toContain("data-session-done");
    expect(shown.home).not.toContain("/training/log/older-draft");
    expect(shown.card).toContain("data-session-done");
    expect(shown.card).toContain("Start again");
    expect(shown.card).toContain('href="/training/lift/start"');
    expect(shown.card).not.toContain("older-draft");
    expect(shown.card).not.toContain("sealed-short");
    expect(shown.today).toEqual({ verb: "Start again", href: "/training/lift/start" });
  });

  it("shows Done everywhere for a lone finished short dose, with Start again", () => {
    const shown = surfaces([shortFinish]);
    expect(shown.face).toMatchObject({ id: "sealed-short", label: "done" });
    expect(shown.home).toContain("data-session-done");
    expect(shown.home).not.toContain("Resume");
    expect(shown.card).toContain("data-session-done");
    expect(shown.card).toContain("Start again");
    expect(shown.card).not.toContain("Resume");
    expect(shown.today).toEqual({ verb: "Start again", href: "/training/lift/start" });
    expect(shown.today?.href).not.toContain("sealed-short");
  });

  it("keeps an open partial bag day resumable and ignores a newer blank draft", () => {
    const partial = log({
      id: "bag-partial",
      status: "partial",
      performedAt: new Date("2026-11-17T15:00:00.000Z"),
      sets: [ticked("Jab")],
      programDay: { exercises: [{ name: "Jab", sets: 3 }, { name: "Shadowbox", sets: 3 }] },
    });
    expect(faceOf([partial])).toMatchObject({ id: "bag-partial", label: "resume", partial: true });
    const blank = log({
      id: "blank",
      status: "draft",
      performedAt: new Date("2026-11-17T18:00:00.000Z"),
      sets: [
        {
          exerciseName: "Jab",
          completed: false,
          reps: null,
          loadValue: null,
          durationSeconds: null,
        },
      ],
    });
    expect(faceOf([blank, partial])).toMatchObject({ id: "bag-partial", label: "resume" });
    expect(faceOf([blank, shortFinish])?.label).toBe("done");
  });
});
