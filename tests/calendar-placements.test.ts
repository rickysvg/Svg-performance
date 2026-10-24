import { describe, expect, it } from "vitest";
import { applySessionPlacements } from "@/lib/calendar-placements";

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
});
