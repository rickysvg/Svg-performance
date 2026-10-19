"use client";

import { useSyncExternalStore } from "react";

type RemoveToastState = {
  message: string;
  undo?: () => void | Promise<void>;
};

let current: RemoveToastState | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showRemoveToast(toast: RemoveToastState) {
  current = toast;
  emit();
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    if (current === toast) clearRemoveToast();
  }, 5000);
}

export function clearRemoveToast() {
  current = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function RemoveToast() {
  const toast = useSyncExternalStore(subscribe, () => current, () => null);
  if (!toast) return null;
  return (
    <div
      data-remove-toast
      role="status"
      className="fixed inset-x-4 z-50 flex items-center justify-between gap-3 rounded-2xl bg-black px-4 py-3 text-white shadow-lg"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <p className="text-sm">{toast.message}</p>
      {toast.undo ? (
        <button
          type="button"
          data-remove-undo
          onClick={() => {
            const run = toast.undo;
            clearRemoveToast();
            if (run) void run();
          }}
          className="inline-flex min-h-11 shrink-0 items-center font-semibold text-highlighter"
        >
          Undo
        </button>
      ) : null}
    </div>
  );
}
