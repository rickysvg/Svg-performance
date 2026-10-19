/** Member-facing words. Daru conditioning menus stay; the GPP acronym does not. */
export function memberCopy(text: string) {
  return text.replace(/\bGPP\b/g, "Cardio").replace(/\bgpp\b/g, "cardio");
}

/** New members should not see seeded DEMO labels or catalog day numbers. */
export function memberFacingTitle(title: string) {
  return memberCopy(title)
    .replace(/^DEMO\s*[—–-]\s*/i, "")
    .replace(/^Day\s+\d+\s*[—–-]\s*/i, "")
    .trim();
}
