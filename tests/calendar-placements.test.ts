import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applySessionPlacements, placementAfterMoveBack } from "@/lib/calendar-placements";

describe("calendar placement overlay", () => {
  const days = [
    {
      weekday: "Sunday",
      activities: [
        { sessionKey: "cardio", title: "Cardio", weekday: "Sunday" },
        { sessionKey: "lift", title: "Lift", weekday: "Sunday" },
      ],
    },
    {
      weekday: "Monday",
      activities: [{ sessionKey: "bag", title: "Bag", weekday: "Monday" }],
    },
  ];

  it("moves a session onto the committed weekday and leaves the others", () => {
    const next = applySessionPlacements(days, { cardio: "Monday" });
    expect(next[0]?.activities.map((row) => row.sessionKey)).toEqual(["lift"]);
    expect(next[1]?.activities.map((row) => row.sessionKey)).toEqual(["cardio", "bag"]);
  });

  it("keeps the server list when the card is already on that weekday", () => {
    expect(applySessionPlacements(days, { cardio: "Sunday" })).toBe(days);
  });

  it("puts a moved card back on Friday while the server list still shows today", () => {
    const week = [
      { weekday: "Friday", activities: [] as { sessionKey: string; title: string; weekday: string }[] },
      {
        weekday: "Saturday",
        activities: [{ sessionKey: "mobility", title: "Mobility", weekday: "Saturday" }],
      },
      {
        weekday: "Sunday",
        activities: [{ sessionKey: "cardio", title: "Cardio", weekday: "Sunday" }],
      },
    ];
    const onToday = { mobility: "Saturday" };
    expect(applySessionPlacements(week, onToday)).toBe(week);

    const back = placementAfterMoveBack(onToday, "mobility", "Friday");
    const live = applySessionPlacements(week, back);
    expect(live.find((day) => day.weekday === "Friday")?.activities.map((row) => row.sessionKey)).toEqual([
      "mobility",
    ]);
    expect(live.find((day) => day.weekday === "Saturday")?.activities.map((row) => row.sessionKey)).toEqual([]);
    expect(live.find((day) => day.weekday === "Sunday")?.activities.map((row) => row.title)).toEqual(["Cardio"]);

    const refreshed = [
      {
        weekday: "Friday",
        activities: [{ sessionKey: "mobility", title: "Mobility", weekday: "Friday" }],
      },
      { weekday: "Saturday", activities: [] as { sessionKey: string; title: string; weekday: string }[] },
      {
        weekday: "Sunday",
        activities: [{ sessionKey: "cardio", title: "Cardio", weekday: "Sunday" }],
      },
    ];
    expect(applySessionPlacements(refreshed, back)).toBe(refreshed);
    expect(placementAfterMoveBack(back, "mobility", "Friday")).toBe(back);

    const button = readFileSync("src/components/training/MoveBackButton.tsx", "utf8");
    const move = readFileSync("src/components/training/WorkoutMove.tsx", "utf8");
    expect(button).toContain("moveHome");
    expect(button).not.toContain("useTransition");
    expect(move).toContain("placementAfterMoveBack");
  });
});
