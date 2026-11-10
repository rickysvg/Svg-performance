"use client";

import { useActionState } from "react";
import { createAccessCodeAction, type AccessCodeActionState } from "@/app/actions/access-code";
import { StatusBanner } from "@/components/StatusBanner";

export function AccessCodeForm() {
  const [state, action, pending] = useActionState(
    createAccessCodeAction,
    {} as AccessCodeActionState,
  );
  return (
    <form action={action} data-testid="access-code-create" className="hc-panel space-y-3 px-4 py-4">
      <h2 className="text-lg">New code</h2>
      <StatusBanner error={state.error} success={state.success} />
      <label className="block text-sm">
        Label
        <input
          name="label"
          placeholder="Fighter name (optional)"
          maxLength={80}
          className="mt-1 w-full rounded-xl border border-[#2a3124] bg-black px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Email lock
        <input
          name="emailLock"
          type="email"
          placeholder="Only this email can redeem (optional)"
          className="mt-1 w-full rounded-xl border border-[#2a3124] bg-black px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Duration
        <select
          name="durationDays"
          defaultValue="90"
          className="mt-1 w-full rounded-xl border border-[#2a3124] bg-black px-3 py-3"
        >
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="180">180 days</option>
          <option value="none">No end date</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-full bg-[#CBF805] px-5 text-black disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create code"}
      </button>
    </form>
  );
}
