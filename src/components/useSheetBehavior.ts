"use client";

import { useEffect, useRef } from "react";
import { cycleFocusIndex, isSheetBackdropTarget } from "@/lib/sheet-focus";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

const stack: Array<() => void> = [];

function focusableIn(panel: HTMLElement) {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.hasAttribute("disabled") || element.tabIndex === -1) return false;
    if (element.closest("[hidden]")) return false;
    return true;
  });
}

/**
 * Escape closes the topmost sheet, Tab stays inside it, and focus returns
 * to whatever opened it. Mount the sheet only while it is open.
 */
export function useSheetBehavior(onClose: () => void, open = true) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const close = () => onCloseRef.current();
    stack.push(close);

    function onKey(event: KeyboardEvent) {
      if (stack[stack.length - 1] !== close) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const index = items.findIndex((item) => item === document.activeElement);
      const atEnd = index === items.length - 1;
      const atStart = index <= 0;
      if (!event.shiftKey && (index < 0 || atEnd)) {
        event.preventDefault();
        items[cycleFocusIndex(index, items.length, false)]?.focus();
      } else if (event.shiftKey && (index < 0 || atStart)) {
        event.preventDefault();
        items[cycleFocusIndex(index, items.length, true)]?.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    const preferred = panel?.querySelector<HTMLElement>("[autofocus]");
    const items = panel ? focusableIn(panel) : [];
    (preferred ?? items[0] ?? panel)?.focus();

    return () => {
      const index = stack.lastIndexOf(close);
      if (index >= 0) stack.splice(index, 1);
      window.removeEventListener("keydown", onKey);
      if (previously && document.contains(previously)) previously.focus();
    };
  }, [open]);

  return panelRef;
}

export function onSheetBackdropMouseDown(
  event: { target: EventTarget | null; currentTarget: EventTarget | null },
  onClose: () => void,
) {
  if (isSheetBackdropTarget(event.target, event.currentTarget)) onClose();
}
