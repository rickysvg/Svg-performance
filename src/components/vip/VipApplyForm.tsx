"use client";

import { useActionState, useState } from "react";
import { submitVipApplicationAction, type VipActionState } from "@/app/actions/vip";
import { StatusBanner } from "@/components/StatusBanner";
import { VIP_REPLY_PROMISE } from "@/lib/vip-coaching";

export function VipApplyForm() {
  const [state, action, pending] = useActionState(submitVipApplicationAction, {} as VipActionState);
  const [noFight, setNoFight] = useState(false);
  const [fightDate, setFightDate] = useState("");
  return (
    <form data-testid="vip-apply-vip-form" action={action} className="space-y-4" data-vip-form="1">
      <StatusBanner error={state.error} />
      <label className="block">
        <span className="text-sm font-medium">Goals</span>
        <textarea
          data-testid="vip-apply-goals"
          name="goals"
          required
          rows={4}
          placeholder="What do you want the next few months to change?"
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Experience and level</span>
        <textarea
          data-testid="vip-apply-experience"
          name="experience"
          required
          rows={3}
          placeholder="Years training, sport, and where you are right now"
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Upcoming fight date</span>
        <input
          data-testid="vip-apply-fight-date"
          name="fightDate"
          type="date"
          value={noFight ? "" : fightDate}
          disabled={noFight}
          onChange={(event) => setFightDate(event.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3 disabled:opacity-50"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          data-testid="vip-apply-no-fight"
          name="noFight"
          type="checkbox"
          checked={noFight}
          onChange={(event) => {
            const checked = event.target.checked;
            setNoFight(checked);
            if (checked) setFightDate("");
          }}
          className="h-4 w-4 accent-[#CBF805]"
        />
        No fight on the calendar
      </label>
      <label className="block">
        <span className="text-sm font-medium">Injuries</span>
        <textarea
          data-testid="vip-apply-injuries"
          name="injuries"
          required
          rows={3}
          placeholder="What should I know, or write none"
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Weekly availability</span>
        <textarea
          data-testid="vip-apply-availability"
          name="availability"
          required
          rows={3}
          placeholder="Days and times you can train"
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <p className="text-sm text-muted" data-vip-promise>
        {VIP_REPLY_PROMISE}
      </p>
      <button
        data-testid="vip-apply-submit-application"
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-[#CBF805] font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Sending…" : "Submit application"}
      </button>
    </form>
  );
}
