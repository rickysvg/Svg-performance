/** Member-facing words. Daru conditioning menus stay; the GPP acronym does not. */
export function memberCopy(text: string) {
  return text.replace(/\bGPP\b/g, "Cardio").replace(/\bgpp\b/g, "cardio");
}
