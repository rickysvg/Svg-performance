"use client";

import { useState, type ReactNode } from "react";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";
import { onSheetBackdropMouseDown, useSheetBehavior } from "@/components/useSheetBehavior";

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
  const panelRef = useSheetBehavior(() => setOpen(false), open);

  return (
    <>
      <button type="button" data-testid="home-sheet-open" onClick={() => setOpen(true)} className="block w-full text-left">
        {children}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          data-testid="home-upgrade-sheet"
          onMouseDown={(event) => onSheetBackdropMouseDown(event, () => setOpen(false))}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Upgrade"
            tabIndex={-1}
            className={
              kind === "coach"
                ? "relative z-10 w-full max-w-md rounded-t-3xl bg-[#0b0c0e] px-5 pt-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] shadow-xl outline-none sm:rounded-3xl sm:pb-6"
                : "relative z-10 w-full max-w-md rounded-t-3xl bg-white px-5 pt-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] shadow-xl outline-none sm:rounded-3xl sm:pb-6"
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
