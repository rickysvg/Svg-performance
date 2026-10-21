/** Member-facing words. Daru conditioning menus stay; the GPP acronym does not. */
export function memberCopy(text: string) {
  return text
    .replace(/\bGPP\b/g, "Cardio")
    .replace(/\bgpp\b/g, "cardio")
    .replace(/\bFriday circuit\b/gi, "Conditioning");
}

/** Drop the seeded sample label from anything a member can read. */
export function stripDemoLabel(text: string) {
  return text
    .replace(/\bDEMO\b\s*[—–-]\s*/gi, "")
    .replace(/\bDEMO\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

/** New members should not see seeded sample labels or catalog day numbers. */
export function memberFacingTitle(title: string) {
  return stripDemoLabel(memberCopy(title))
    .replace(/^Day\s+\d+\s*[—–-]\s*/i, "")
    .trim();
}
