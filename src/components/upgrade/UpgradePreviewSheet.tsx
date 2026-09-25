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
  kind: "tutorial" | "fuel" | "coach" | "charts";
  canStartTrial: boolean;
  trialDays: number;
  next?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
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
          <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-white p-2 shadow-xl sm:rounded-3xl">
            <UpgradePreview
              kind={kind}
              canStartTrial={canStartTrial}
              trialDays={trialDays}
              next={next}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="touch-target mx-auto mb-2 mt-1 block w-[calc(100%-1.5rem)] rounded-full border border-line font-semibold"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
