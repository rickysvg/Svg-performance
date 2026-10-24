"use client";

import Link from "next/link";
import { useState, type PropsWithChildren } from "react";
import { onSheetBackdropMouseDown, useSheetBehavior } from "@/components/useSheetBehavior";
import {
  FORM_CHECK_APPLY_PATH,
  FORM_CHECK_LOCKED_BODY,
  FORM_CHECK_LOCKED_TITLE,
} from "@/lib/form-check-shared";

function LockSvg() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="block">
      <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FormCheckLockIcon({ placement = "overlay" }: { placement?: "overlay" | "inline" }) {
  const position =
    placement === "overlay"
      ? "absolute top-2 right-2 z-10"
      : "relative";
  return (
    <span
      data-testid="form-check-lock-icon"
      className={`${position} inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/85 text-[#FF3B3B] ring-1 ring-[#FF3B3B]`}
    >
      <LockSvg />
      <span className="sr-only">Locked</span>
    </span>
  );
}

export function FormCheckLockedSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useSheetBehavior(onClose, open);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      data-testid="form-check-locked-backdrop"
      onMouseDown={(event) => onSheetBackdropMouseDown(event, onClose)}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-check-locked-heading"
        tabIndex={-1}
        data-testid="form-check-locked-sheet"
        className="hc-carbon relative z-10 w-full max-w-md rounded-t-3xl border border-[#FF3B3B]/80 px-5 pt-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] text-white shadow-xl outline-none sm:rounded-3xl sm:pb-6"
      >
        <div className="flex items-start justify-end gap-3">
          <button
            type="button"
            data-testid="form-check-locked-close"
            aria-label="Close"
            onClick={onClose}
            className="touch-target -mr-2 -mt-2 px-3 text-2xl leading-none text-[#CBF805]"
          >
            ×
          </button>
        </div>
        <h2
          id="form-check-locked-heading"
          data-testid="form-check-locked-title"
          className="mt-3 font-display text-3xl uppercase leading-none tracking-wide text-white"
        >
          {FORM_CHECK_LOCKED_TITLE}
        </h2>
        <p data-testid="form-check-locked-body" className="mt-3 text-sm text-white/80">
          {FORM_CHECK_LOCKED_BODY}
        </p>
        <Link
          href={FORM_CHECK_APPLY_PATH}
          data-testid="form-check-locked-cta"
          className="touch-target mt-5 flex w-full items-center justify-center rounded-full bg-[#CBF805] text-base font-semibold text-black"
        >
          Apply for VIP Coaching
        </Link>
      </div>
    </div>
  );
}

export function FormCheckLockedTrigger({
  testId,
  className,
  lock = "overlay",
  children,
}: PropsWithChildren<{
  testId: string;
  className?: string;
  lock?: "overlay" | "inline";
}>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid={testId} onClick={() => setOpen(true)} className={className}>
        {lock === "inline" ? <FormCheckLockIcon placement="inline" /> : null}
        {children}
        {lock === "overlay" ? <FormCheckLockIcon placement="overlay" /> : null}
      </button>
      <FormCheckLockedSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function FormCheckLockedView({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button
        type="button"
        data-testid="form-check-locked-trigger-page"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-[1.5rem] border border-[#FF3B3B]/70 bg-black px-4 py-4 text-left font-inherit text-white"
      >
        <FormCheckLockIcon placement="inline" />
        <span>
          <span className="font-display text-xl uppercase tracking-wide">Form check</span>
        </span>
      </button>
      <FormCheckLockedSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
