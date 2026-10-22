/** Copy and settle rules for the My Workouts rename and apply sheets. */

export const REPLACE_LOGGED_CONFIRM = "You have logged sets on this day. Replace anyway?";

export const APPLY_TOAST = "Applied.";

export const RENAME_TOAST_MS = 3000;

export const APPLY_TOAST_MS = 3000;

export function renameToast(name: string) {
  return `Saved as “${name}”.`;
}

export function renameSheetSettle(input: { renamed: boolean; name?: string }) {
  if (!input.renamed || !input.name) return { close: false, toast: null as string | null };
  return { close: true, toast: renameToast(input.name) };
}

/**
 * The Apply sheet stays open until the save settles.
 * The double-tap lock releases on success and on every error, including a repeat of the same message.
 * `open: null` means the sheet should not change (still in flight, or nothing was submitted).
 */
export function applySheetSettle(input: { pending: boolean; started: boolean; applied: boolean }) {
  if (input.pending || !input.started) {
    return { locked: input.started && input.pending, open: null as boolean | null, toast: null as string | null };
  }
  if (input.applied) return { locked: false, open: false, toast: APPLY_TOAST };
  return { locked: false, open: true, toast: null as string | null };
}
