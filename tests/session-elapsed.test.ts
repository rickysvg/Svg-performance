import { describe, expect, it } from "vitest";
import { sessionDurationSeconds, SESSION_DURATION_CAP_SECONDS } from "@/lib/share-card";
import {
  elapsedSecondsToFreeze,
  formatSessionElapsed,
  freezeElapsedOnSave,
  resolveSessionElapsed,
  STALE_DRAFT_SECONDS,
} from "@/lib/session-elapsed";

const NOW = new Date("2026-10-21T18:00:00.000Z");

describe("session header elapsed clock", () => {
  it("formats an hour or more as H:MM:SS and shorter clocks as MM:SS", () => {
    expect(formatSessionElapsed(0)).toBe("00:00");
    expect(formatSessionElapsed(90)).toBe("01:30");
    expect(formatSessionElapsed(3599)).toBe("59:59");
    expect(formatSessionElapsed(3600)).toBe("1:00:00");
    expect(formatSessionElapsed(3661)).toBe("1:01:01");
    expect(formatSessionElapsed(70 * 60 + 25)).toBe("1:10:25");
  });

  it("keeps a saved workout on its frozen duration and does not tick", () => {
    const createdAt = new Date(NOW.getTime() - 23 * 60 * 60 * 1000);
    const view = resolveSessionElapsed(
      {
        status: "complete",
        createdAt,
        updatedAt: NOW,
        finishedAt: new Date(createdAt.getTime() + (70 * 60 + 25) * 1000),
        elapsedSeconds: 70 * 60 + 25,
      },
      NOW,
    );
    expect(view.ticking).toBe(false);
    expect(view.seconds).toBe(70 * 60 + 25);
    expect(view.label).toBe("1:10:25");
  });

  it("derives a capped static duration for a completed session saved before the freeze columns", () => {
    const createdAt = new Date("2026-10-20T16:00:00.000Z");
    const updatedAt = new Date("2026-10-20T17:10:25.000Z");
    const view = resolveSessionElapsed(
      { status: "complete", createdAt, updatedAt, finishedAt: null, elapsedSeconds: null },
      NOW,
    );
    expect(view.ticking).toBe(false);
    expect(view.label).toBe("1:10:25");
    expect(view.seconds).not.toBe(Math.floor((NOW.getTime() - createdAt.getTime()) / 1000));
  });

  it("ticks a live draft and a resumed session from the frozen base", () => {
    const live = resolveSessionElapsed(
      {
        status: "draft",
        createdAt: new Date(NOW.getTime() - 125_000),
        elapsedSeconds: null,
        timerStartedAt: null,
      },
      NOW,
    );
    expect(live.ticking).toBe(true);
    expect(live.label).toBe("02:05");

    const resumed = resolveSessionElapsed(
      {
        status: "draft",
        createdAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
        elapsedSeconds: 90 * 60,
        timerStartedAt: new Date(NOW.getTime() - 30_000),
      },
      NOW,
    );
    expect(resumed.ticking).toBe(true);
    expect(resumed.seconds).toBe(90 * 60 + 30);
    expect(resumed.label).toBe("1:30:30");
  });

  it("does not show a multi-day draft as 1397 minutes", () => {
    const createdAt = new Date(NOW.getTime() - (1397 * 60 + 25) * 1000);
    const view = resolveSessionElapsed(
      { status: "draft", createdAt, elapsedSeconds: null, timerStartedAt: null },
      NOW,
    );
    expect(createdAt.getTime()).toBeLessThan(NOW.getTime() - STALE_DRAFT_SECONDS * 1000);
    expect(view.ticking).toBe(false);
    expect(view.stale).toBe(true);
    expect(view.label).toBe("Paused");
    expect(view.seconds).toBeLessThan(SESSION_DURATION_CAP_SECONDS);
    expect(view.label).not.toContain("1397");
  });

  it("ignores a stored 4 hour cap and counts only the live segment", () => {
    const view = resolveSessionElapsed(
      {
        status: "draft",
        createdAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000),
        elapsedSeconds: 14400,
        timerStartedAt: new Date(NOW.getTime() - 10_000),
      },
      NOW,
    );
    expect(view.ticking).toBe(true);
    expect(view.label).toBe("00:10");
    expect(view.label).not.toBe("4:00:00");
  });

  it("caps a long-but-not-abandoned draft instead of counting past four hours", () => {
    const view = resolveSessionElapsed(
      {
        status: "draft",
        createdAt: new Date(NOW.getTime() - (SESSION_DURATION_CAP_SECONDS + 60) * 1000),
      },
      NOW,
    );
    expect(view.ticking).toBe(false);
    expect(view.capped).toBe(true);
    expect(view.label).toBe("4:00:00");
  });

  it("freezes the reported clock on Save and keeps that value if Save runs again", () => {
    const createdAt = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);
    const draft = { status: "draft", createdAt, updatedAt: NOW, elapsedSeconds: null, timerStartedAt: null };
    const first = freezeElapsedOnSave(draft, NOW, 47 * 60 + 12);
    expect(first.elapsedSeconds).toBe(47 * 60 + 12);
    expect(first.finishedAt).toEqual(NOW);
    expect(first.timerStartedAt).toBeNull();

    const again = freezeElapsedOnSave(
      { ...draft, status: "complete", finishedAt: first.finishedAt, elapsedSeconds: first.elapsedSeconds },
      new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
      10,
    );
    expect(again.elapsedSeconds).toBe(47 * 60 + 12);
    expect(again.finishedAt).toEqual(NOW);

    const grown = freezeElapsedOnSave(
      { ...draft, status: "complete", finishedAt: first.finishedAt, elapsedSeconds: 660 },
      new Date(NOW.getTime() + 60_000),
      900,
    );
    expect(grown.elapsedSeconds).toBe(900);
    expect(grown.finishedAt).toEqual(NOW);
  });

  it("keeps the live segment after Resume when the posted clock is short", () => {
    const resumed = {
      status: "draft",
      createdAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
      elapsedSeconds: 600,
      timerStartedAt: new Date(NOW.getTime() - 25_000),
    };
    expect(elapsedSecondsToFreeze(resumed, NOW, 606)).toBe(625);
    const saved = freezeElapsedOnSave(resumed, NOW, 606);
    expect(saved.elapsedSeconds).toBe(625);
    expect(saved.timerStartedAt).toBeNull();
  });

  it("ignores an absurd reported value and an unreported multi-day gap", () => {
    const createdAt = new Date(NOW.getTime() - (1397 * 60 + 25) * 1000);
    const session = { status: "draft", createdAt, updatedAt: NOW };
    expect(elapsedSecondsToFreeze(session, NOW, 1397 * 60 + 25)).toBe(SESSION_DURATION_CAP_SECONDS);
    expect(elapsedSecondsToFreeze(session, NOW, null)).toBe(0);
  });

  it("uses the frozen elapsed seconds on a completed share card", () => {
    const seconds = sessionDurationSeconds({
      title: "Lift 2 — Full body",
      status: "complete",
      performedAt: NOW,
      createdAt: new Date(NOW.getTime() - 20 * 60 * 60 * 1000),
      updatedAt: NOW,
      elapsedSeconds: 75 * 60,
      sets: [
        {
          exerciseName: "Goblet squat",
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    expect(seconds).toBe(75 * 60);
  });
});
