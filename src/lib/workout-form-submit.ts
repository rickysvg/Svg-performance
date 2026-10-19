/**
 * The logger form's first submit button is SAVE, which marks the session
 * complete. Enter in a text field (the swap search, reps, load) activates
 * that button. Textareas keep Enter for a new line. An explicit SAVE click
 * is a button, not one of these fields.
 */
export function fieldEnterFinishesWorkout(tagName: string, inputType: string | null | undefined) {
  const tag = tagName.toLowerCase();
  if (tag === "textarea") return false;
  if (tag === "button") return false;
  if (tag === "input") {
    const kind = (inputType || "text").toLowerCase();
    if (
      kind === "submit" ||
      kind === "button" ||
      kind === "reset" ||
      kind === "checkbox" ||
      kind === "radio" ||
      kind === "file" ||
      kind === "hidden"
    ) {
      return false;
    }
    return true;
  }
  if (tag === "select") return true;
  return false;
}
