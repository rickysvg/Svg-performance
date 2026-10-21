"use client";

import { useActionState } from "react";
import {
  approveVipApplicationAction,
  declineVipApplicationAction,
  type VipActionState,
} from "@/app/actions/vip";
import { StatusBanner } from "@/components/StatusBanner";

export function VipReviewButtons({ applicationId }: { applicationId: string }) {
  const [approved, approve, approving] = useActionState(approveVipApplicationAction, {} as VipActionState);
  const [declined, decline, declining] = useActionState(declineVipApplicationAction, {} as VipActionState);
  return (
    <div className="space-y-2">
      <StatusBanner error={approved.error || declined.error} />
      <div className="flex gap-2">
        <form action={approve} className="flex-1">
          <input type="hidden" name="applicationId" value={applicationId} />
          <button
            type="submit"
            disabled={approving || declining}
            className="touch-target w-full rounded-full bg-[#CBF805] text-sm font-semibold text-black disabled:opacity-60"
          >
            {approving ? "Approving…" : "Approve"}
          </button>
        </form>
        <form action={decline} className="flex-1">
          <input type="hidden" name="applicationId" value={applicationId} />
          <button
            type="submit"
            disabled={approving || declining}
            className="touch-target w-full rounded-full bg-[#FF3B3B] text-sm font-semibold text-white disabled:opacity-60"
          >
            {declining ? "Declining…" : "Decline"}
          </button>
        </form>
      </div>
    </div>
  );
}
