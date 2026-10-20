/** Visible title for the week chart on Home and Progress. */
export function telemetryGraphTitle(input: {
  status?: string | null;
  fightDateKey?: string | null;
  todayKey: string;
}) {
  const fightDateKey = input.fightDateKey?.trim() ?? "";
  const upcoming =
    input.status === "active" &&
    /^\d{4}-\d{2}-\d{2}$/.test(fightDateKey) &&
    fightDateKey >= input.todayKey;
  return upcoming ? "Fight Camp Telemetry" : "Training Telemetry";
}
