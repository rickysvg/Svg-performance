"use client";

import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Confirmation toasts leave on their own. Undo toasts pass a longer duration. */
export const TOAST_DISMISS_MS = 3000;

type ToastAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  attrs?: Record<string, string>;
};

export function Toast({
  message,
  onDismiss,
  durationMs = TOAST_DISMISS_MS,
  tone = "lime",
  placement = "above-chrome",
  action,
  attrs,
  closeTestId = "chrome-toast-close",
  actionTestId = "chrome-toast-action",
}: {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
  tone?: "lime" | "dark" | "danger" | "outline";
  placement?: "above-chrome" | "top";
  action?: ToastAction;
  attrs?: Record<string, string>;
  closeTestId?: string;
  /** Unique per toast. Prefix `chrome-toast-action-` so the suite can match one pattern. */
  actionTestId?: string;
}) {
  const dismiss = useEffectEvent(() => {
    onDismiss();
  });
  const mounted = useIsClient();

  useEffect(() => {
    if (durationMs <= 0) return;
    const id = window.setTimeout(() => dismiss(), durationMs);
    return () => window.clearTimeout(id);
  }, [durationMs, message]);

  if (!mounted) return null;

  const toneClass =
    tone === "dark"
      ? "border border-white/15 bg-black text-white"
      : tone === "danger"
        ? "border border-danger/40 bg-danger/10 text-danger"
        : tone === "outline"
          ? "border border-[#cbf805] bg-black text-[#cbf805]"
          : "border border-black/20 bg-accent text-black";

  return createPortal(
    <div
      role="status"
      data-app-toast=""
      {...attrs}
      className={`app-toast flex items-center shadow-lg ${
        placement === "top" ? "app-toast-top rounded-full" : "rounded-xl"
      } ${toneClass}`}
    >
      <p className="min-w-0 flex-1 py-3 pl-4 text-sm leading-snug">{message}</p>
      {action ? (
        <button
          type="button"
          {...action.attrs}
          data-testid={actionTestId}
          disabled={action.disabled}
          onClick={action.onClick}
          className={`inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-semibold disabled:opacity-60 ${
            tone === "dark" || tone === "outline" ? "text-highlighter" : "text-current"
          }`}
        >
          {action.label}
        </button>
      ) : null}
      <button
        type="button"
        data-toast-close
        data-testid={closeTestId}
        aria-label="Close"
        onClick={onDismiss}
        className="touch-target inline-flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            tone === "dark" || tone === "outline" ? "bg-white text-black" : "bg-black text-white"
          }`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden className="block">
            <path
              d="M6 6 L18 18 M18 6 L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.75"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>
    </div>,
    document.body,
  );
}
