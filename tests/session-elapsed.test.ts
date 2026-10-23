import { describe, expect, it } from "vitest";
import { sessionDurationSeconds, SESSION_DURATION_CAP_SECONDS } from "@/lib/share-card";
import {
  elapsedSecondsToFreeze,
  foldActivityGap,
  formatSessionElapsed,
  freezeElapsedOnSave,
  resolveSessionElapsed,
  sessionRecordsActivity,
  STALE_DRAFT_SECONDS,
  wakeActivityClock,
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

  it("keeps a stored 4 hour clock and does not count past the cap", () => {
    const view = resolveSessionElapsed(
      {
        status: "draft",
        createdAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000),
        elapsedSeconds: SESSION_DURATION_CAP_SECONDS,
        timerStartedAt: new Date(NOW.getTime() - 10_000),
      },
      NOW,
    );
    expect(view.capped).toBe(true);
    expect(view.seconds).toBe(SESSION_DURATION_CAP_SECONDS);
    expect(view.label).toBe("4:00:00");
  });

  it("counts a long idle gap as ten minutes, and the four hour cap still stops the total", () => {
    const idle = resolveSessionElapsed(
      {
        status: "draft",
        createdAt: new Date(NOW.getTime() - (SESSION_DURATION_CAP_SECONDS + 60) * 1000),
      },
      NOW,
    );
    expect(idle.ticking).toBe(true);
    expect(idle.seconds).toBe(10 * 60);
    expect(idle.label).toBe("10:00");

    const nearCap = resolveSessionElapsed(
      {
        status: "draft",
        createdAt: NOW,
        elapsedSeconds: SESSION_DURATION_CAP_SECONDS - 30,
        timerStartedAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
      },
      NOW,
    );
    expect(nearCap.seconds).toBe(SESSION_DURATION_CAP_SECONDS);
    expect(nearCap.label).toBe("4:00:00");
  });

  it("adds about 25s of work, ten minutes for a 2h gap, and a full 3 minute rest", () => {
    const worked = {
      status: "draft" as const,
      createdAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
      elapsedSeconds: 600,
      timerStartedAt: new Date(NOW.getTime() - 25_000),
    };
    expect(resolveSessionElapsed(worked, NOW).seconds).toBe(625);
    expect(elapsedSecondsToFreeze(worked, NOW, 606)).toBe(625);

    const away = {
      status: "draft" as const,
      createdAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000),
      elapsedSeconds: 600,
      timerStartedAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
    };
    expect(resolveSessionElapsed(away, NOW).seconds).toBe(600 + 10 * 60);
    expect(elapsedSecondsToFreeze(away, NOW, 600 + 7215)).toBe(600 + 10 * 60);

    let active = 600;
    for (let beat = 0; beat < 6; beat += 1) active = foldActivityGap(active, 30);
    expect(active).toBe(600 + 180);
    const afterAway = foldActivityGap(active, 2 * 60 * 60);
    expect(afterAway).toBe(600 + 180 + 10 * 60);

    const locked = {
      status: "draft" as const,
      createdAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      elapsedSeconds: active,
      timerStartedAt: new Date(NOW.getTime() - 3 * 60 * 1000),
    };
    expect(resolveSessionElapsed(locked, NOW).seconds).toBe(active + 180);
    expect(elapsedSecondsToFreeze(locked, NOW, active + 180)).toBe(active + 180);
  });

  it("ticks again as soon as the logger wakes after a gap past ten minutes", () => {
    const base = 31 * 60 + 27;
    const anchor = new Date(NOW.getTime() - 11 * 60 * 1000);
    const asleep = {
      status: "draft" as const,
      createdAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      elapsedSeconds: base,
      timerStartedAt: anchor,
    };
    expect(resolveSessionElapsed(asleep, NOW).seconds).toBe(base + 10 * 60);
    expect(resolveSessionElapsed(asleep, new Date(NOW.getTime() + 30_000)).seconds).toBe(base + 10 * 60);
    const woken = wakeActivityClock(base, anchor.getTime(), NOW.getTime());
    expect(woken.elapsed).toBe(base + 10 * 60);
    expect(woken.at).toBe(NOW.getTime());
    expect(
      resolveSessionElapsed(
        { ...asleep, elapsedSeconds: woken.elapsed, timerStartedAt: woken.at },
        new Date(NOW.getTime() + 1000),
      ).seconds,
    ).toBe(base + 10 * 60 + 1);
    expect(sessionRecordsActivity("draft")).toBe(true);
    expect(sessionRecordsActivity("partial")).toBe(false);
    expect(sessionRecordsActivity("complete")).toBe(false);
  });

  it("keeps a capped clock when a resumed save is stale", () => {
    const session = {
      status: "draft" as const,
      createdAt: new Date(NOW.getTime() - 20 * 60 * 60 * 1000),
      elapsedSeconds: SESSION_DURATION_CAP_SECONDS,
      timerStartedAt: new Date(NOW.getTime() - 13 * 60 * 60 * 1000),
    };
    expect(elapsedSecondsToFreeze(session, NOW, 0)).toBe(SESSION_DURATION_CAP_SECONDS);
    expect(resolveSessionElapsed(session, NOW).label).toBe("Paused");
    expect(resolveSessionElapsed(session, NOW).seconds).toBe(SESSION_DURATION_CAP_SECONDS);
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
