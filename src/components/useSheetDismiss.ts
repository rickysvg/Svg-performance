"use client";

import { useEffect } from "react";

/**
 * Shared sheet behavior: lock background scroll and close when Escape is pressed.
 * Callers keep their own dialog markup.
 */
export function useSheetDismiss(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [enabled, onClose]);
}
