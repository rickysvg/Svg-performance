/**
 * Intake is three steps. Step 1 (imagery and days) is not saved until the
 * end, so a leftover "step 2" in this browser must not skip it.
 */
export function intakeStepForProfile(
  profile: { athleteImagery?: string | null; weeklyAvailability?: readonly string[] | null },
  storedStep: string | null,
): 1 | 2 {
  const imageryReady = profile.athleteImagery === "male" || profile.athleteImagery === "female";
  const daysReady = (profile.weeklyAvailability?.length ?? 0) > 0;
  if (!imageryReady || !daysReady) return 1;
  return storedStep === "2" ? 2 : 1;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** Why Save cannot leave step 2. Null when step 1 is filled in. */
export function earlierIntakeGap(input: {
  athleteImagery?: string | null;
  dayCount: number;
  displayName?: string | null;
}): string | null {
  const imageryReady = input.athleteImagery === "male" || input.athleteImagery === "female";
  const daysReady = input.dayCount > 0;
  const nameReady = Boolean(input.displayName?.trim());
  if (imageryReady && daysReady && nameReady) return null;
  const missing: string[] = [];
  if (!imageryReady) missing.push("male or female athlete imagery");
  if (!daysReady) missing.push("at least one day you can train");
  if (!nameReady) missing.push("what we should call you");
  return `Step 1 is still open. Go back and add ${joinList(missing)}.`;
}
