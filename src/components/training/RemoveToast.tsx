"use client";

import { useSyncExternalStore } from "react";
import { Toast } from "@/components/Toast";

type RemoveToastInput = {
  message: string;
  undo?: () => void | Promise<void>;
};

type RemoveToastState = RemoveToastInput & { id: number };

export const REMOVE_TOAST_MS = 8000;

let nextId = 1;
let current: RemoveToastState | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showRemoveToast(toast: RemoveToastInput) {
  const next: RemoveToastState = { ...toast, id: nextId++ };
  current = next;
  emit();
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    if (current === next) clearRemoveToast();
  }, REMOVE_TOAST_MS);
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
    <Toast
      key={toast.id}
      message={toast.message}
      tone="dark"
      durationMs={REMOVE_TOAST_MS}
      onDismiss={clearRemoveToast}
      attrs={{ "data-remove-toast": "" }}
      action={
        toast.undo
          ? {
              label: "Undo",
              attrs: { "data-remove-undo": "" },
              onClick: () => {
                const run = toast.undo;
                clearRemoveToast();
                if (run) void run();
              },
            }
          : undefined
      }
    />
  );
}
