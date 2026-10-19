/** Member-facing words. Daru conditioning menus stay; the GPP acronym does not. */
export function memberCopy(text: string) {
  return text.replace(/\bGPP\b/g, "Cardio").replace(/\bgpp\b/g, "cardio");
}

/** Yellow welcome line. Hide a brand repeat and a goal that copies itself. */
export function homeSubtitle(goals: string | null | undefined, greetingName = "") {
  const text = (goals ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (/^svg performance$/i.test(text)) return "";
  const welcome = `welcome ${greetingName}`.trim().toLowerCase();
  if (text.toLowerCase() === welcome) return "";
  const parts = text.split(/\s+[—–-]\s+/);
  if (parts.length === 2 && parts[0]!.toLowerCase() === parts[1]!.toLowerCase()) return parts[0]!;
  return text;
}

/** New members should not see seeded DEMO labels or catalog day numbers. */
export function memberFacingTitle(title: string) {
  return memberCopy(title)
    .replace(/^DEMO\s*[—–-]\s*/i, "")
    .replace(/^Day\s+\d+\s*[—–-]\s*/i, "")
    .trim();
}
