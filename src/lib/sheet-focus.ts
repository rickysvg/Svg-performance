/** Move focus inside a dialog. A negative current index means focus is outside the panel. */
export function cycleFocusIndex(current: number, count: number, backward: boolean) {
  if (count <= 0) return -1;
  if (current < 0) return backward ? count - 1 : 0;
  if (backward) return current === 0 ? count - 1 : current - 1;
  return current === count - 1 ? 0 : current + 1;
}

export function isSheetBackdropTarget(target: unknown, current: unknown) {
  return target !== null && target === current;
}
