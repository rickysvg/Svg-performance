import { BIKE_SESSIONS, bikeEnergyForSession, pickBikeSessionForPlan } from "@/lib/bike-sessions";
import type { PlanSessionSlot, PlanWeekday } from "@/lib/week-plan";
import { accessoryNote, plyoBlockFor, type TrainingEmphasis } from "@/lib/training-emphasis";
import { isTrainingEmphasis } from "@/lib/training-emphasis";

export type TrainDayExtra = {
  weekday: PlanWeekday;
  warmup: boolean;
  plyoTitle: string | null;
  plyoFirst: string | null;
  bikeLabel: string | null;
  bikeGuide: string | null;
  neck: boolean;
  deload: boolean;
};

const LIFT_DAYS = new Set<PlanWeekday>(["Monday", "Wednesday"]);

export function trainDayExtra(input: {
  weekday: PlanWeekday;
  active: boolean;
  sessions: PlanSessionSlot[];
  weekIndex: number;
  emphasis?: string | null;
  deload: boolean;
}): TrainDayExtra {
  const emphasis: TrainingEmphasis = isTrainingEmphasis(input.emphasis) ? input.emphasis : "balanced";
  const weekday = input.weekday;
  const bike =
    weekday === "Tuesday" || weekday === "Thursday"
      ? pickBikeSessionForPlan(weekday, input.weekIndex)
      : null;
  const energy = bike ? bikeEnergyForSession(bike) : null;
  const plyo =
    input.active && LIFT_DAYS.has(input.weekday) && input.sessions.some((session) => session.kind === "strength");
  const drills = plyoBlockFor(emphasis);
  return {
    weekday: input.weekday,
    warmup: input.active && input.weekday !== "Sunday",
    plyoTitle: plyo ? "Plyo / power" : null,
    plyoFirst: plyo ? drills[0]?.name ?? null : null,
    bikeLabel: energy?.label ?? null,
    bikeGuide: energy?.guide ?? null,
    neck: input.weekday === "Friday" && input.active,
    deload: input.deload && input.active,
  };
}

export function bikeZoneForDayNumber(dayNumber: number | undefined) {
  if (dayNumber == null) return null;
  const session = BIKE_SESSIONS.find((row) => row.programDayNumber === dayNumber);
  if (!session) return null;
  return bikeEnergyForSession(session);
}

export function emphasisAccessoryLine(emphasis?: string | null) {
  return accessoryNote(emphasis);
}
