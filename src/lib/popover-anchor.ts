export type AnchorRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type AnchorSize = { width: number; height: number };
export type AnchorViewport = { width: number; height: number };

/**
 * Place a popover so the whole panel stays inside the viewport.
 * Prefer opening to the right of the trigger (the logger ··· button sits on
 * the left of the card). The old right-edge anchor drew the panel off the
 * left side of a 390px phone.
 */
export function anchorPopover(
  trigger: AnchorRect,
  menu: AnchorSize,
  viewport: AnchorViewport,
  margin = 8,
): { left: number; top: number } {
  const maxLeft = Math.max(margin, viewport.width - margin - menu.width);
  let left = trigger.left;
  if (left + menu.width > viewport.width - margin) {
    left = trigger.right - menu.width;
  }
  left = Math.min(Math.max(margin, left), maxLeft);

  const below = trigger.bottom + 4;
  const above = trigger.top - 4 - menu.height;
  let top = below;
  if (below + menu.height > viewport.height - margin && above >= margin) {
    top = above;
  }
  const maxTop = Math.max(margin, viewport.height - margin - menu.height);
  top = Math.min(Math.max(margin, top), maxTop);
  return { left, top };
}
