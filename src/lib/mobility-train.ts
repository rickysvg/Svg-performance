/**
 * One mobility pair for a Train session.
 * Activate is the dynamic routine before the work. Recover is the hold after.
 * The Train start button stays the default path.
 */
import { getMobilityRoutine } from "@/lib/mobility";

export type MobilityLink = {
  id: string;
  title: string;
  hint: string;
};

export type MobilityBookend = {
  activate: MobilityLink;
  recover: MobilityLink;
};

function link(id: string, hint: string): MobilityLink {
  const routine = getMobilityRoutine(id);
  if (!routine) {
    throw new Error(`Missing mobility routine ${id}`);
  }
  return { id: routine.id, title: routine.title, hint };
}

function pair(activateId: string, activateHint: string, recoverId: string, recoverHint: string): MobilityBookend {
  return {
    activate: link(activateId, activateHint),
    recover: link(recoverId, recoverHint),
  };
}

function blobOf(input: { title: string; subtitle?: string; label?: string }) {
  return `${input.label ?? ""} ${input.title} ${input.subtitle ?? ""}`.toLowerCase();
}

function bagPair(text: string): MobilityBookend {
  if (/\b(kick|kicks|teep|teeps)\b/.test(text) || text.includes("switch entries")) {
    return pair("kickers-hips", "Before the kicks", "split-builder", "After the kicks");
  }
  if (/\b(knee|knees|clinch|elbow|elbows)\b/.test(text)) {
    return pair("kickers-hips", "Before the clinch", "grapplers-neck-hips", "After the clinch");
  }
  return pair("upper-back", "Before the hands", "cooldown", "After the rounds");
}

export function mobilityBookendsForSession(input: {
  kind: string;
  title: string;
  subtitle?: string;
  label?: string;
}): MobilityBookend | null {
  const kind = input.kind.toLowerCase();
  if (kind === "rest" || kind === "mobility") return null;
  const text = blobOf(input);
  if (/\bgpp\b/.test(text)) {
    return pair("daily-warmup", "Before GPP", "cooldown", "After GPP");
  }
  if (kind === "skill" || kind === "bag" || /\bbag\b/.test(text)) {
    return bagPair(text);
  }
  if (/\bbike\b/.test(text) || text.includes("assault")) {
    return pair("daily-warmup", "Before the bike", "ankle-knee", "After the bike");
  }
  if (/lower|squat|hinge|posterior|unilateral|hamstring/.test(text)) {
    return pair("kickers-hips", "Before the lower lifts", "split-builder", "After the hinges");
  }
  if (/upper|pull|push|rotational|shoulder/.test(text)) {
    return pair("upper-back", "Before the upper lifts", "cooldown", "After the presses");
  }
  if (kind === "strength" || kind === "conditioning" || kind === "lift") {
    return pair("daily-warmup", "Before the session", "cooldown", "After the session");
  }
  return null;
}
