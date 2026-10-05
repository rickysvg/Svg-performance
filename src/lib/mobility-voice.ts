/**
 * Short spoken prompts for a mobility follow-along.
 * The stretch text stays on screen. The voice only marks the beats
 * so the athlete can keep their eyes off the phone.
 */

export type VoiceCueKind = "start" | "switch" | "ten" | "next";

export function mobilityVoiceLine(kind: VoiceCueKind, step?: { name: string }) {
  if (kind === "start") return `Start. ${step?.name ?? "Stretch"}.`;
  if (kind === "switch") return "Switch sides.";
  if (kind === "ten") return "About ten seconds.";
  return `Next. ${step?.name ?? "Stretch"}.`;
}

/** Same stretch, other side → switch. A new stretch → next. */
export function advanceCueKind(
  current: { blockKey: string; side: string },
  next: { blockKey: string; side: string },
): "switch" | "next" {
  if (
    current.blockKey === next.blockKey &&
    current.side !== "" &&
    next.side !== "" &&
    current.side !== next.side
  ) {
    return "switch";
  }
  return "next";
}
