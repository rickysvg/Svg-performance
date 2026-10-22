"use client";

import { useState, type ReactNode } from "react";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";

export function UpgradePreviewSheet({
  kind,
  canStartTrial,
  trialDays,
  next = "/home",
  children,
}: {
  kind: "tutorial" | "seminar" | "fuel" | "coach" | "charts" | "mobility";
  canStartTrial: boolean;
  trialDays: number;
  next?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button data-testid="home-sheet-open" type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        {children}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            className={
              kind === "coach"
                ? "relative z-10 w-full max-w-md rounded-t-3xl bg-[#0b0c0e] px-5 pt-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl sm:pb-6"
                : "relative z-10 w-full max-w-md rounded-t-3xl bg-white px-5 pt-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl sm:pb-6"
            }
          >
            <UpgradePreview
              kind={kind}
              canStartTrial={canStartTrial}
              trialDays={trialDays}
              next={next}
              framed={false}
              onDismiss={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
