"use client";

import { UpgradePreview } from "@/components/upgrade/UpgradePreview";
import type { PaywallReason } from "@/components/coach/useCoachStream";

const KIND: Record<PaywallReason, "ai_limit" | "ai_daily_cap" | "voice" | "read_aloud" | "coach"> = {
  locked: "coach",
  ai_limit: "ai_limit",
  ai_daily_cap: "ai_daily_cap",
  voice: "voice",
  read_aloud: "read_aloud",
};

/** Paywall prompt for the 4th AI message of the week, voice, read-aloud, or the daily fair-use cap. */
export function AiPaywallPrompt({
  reason,
  onDismiss,
  dismissTestId = "ai-paywall-prompt-sheet-close",
  canStartTrial = false,
  trialDays = 7,
}: {
  reason: PaywallReason;
  onDismiss?: () => void;
  dismissTestId?: string;
  canStartTrial?: boolean;
  trialDays?: number;
}) {
  return (
    <div data-paywall={reason}>
      <UpgradePreview
        kind={KIND[reason]}
        canStartTrial={canStartTrial}
        trialDays={trialDays}
        onDismiss={onDismiss}
        dismissTestId={dismissTestId}
      />
    </div>
  );
}
