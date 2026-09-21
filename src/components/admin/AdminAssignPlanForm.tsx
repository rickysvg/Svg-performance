"use client";

import { useActionState } from "react";
import { assignPlanAction, type AdminActionState } from "@/app/actions/admin";
import { StatusBanner } from "@/components/StatusBanner";
import { CATALOG_PLAN_IDS, PLAN_CATALOG } from "@/lib/plans";

export function AdminAssignPlanForm({
  userId,
  currentPlan,
}: {
  userId: string;
  currentPlan?: string;
}) {
  const [state, action, pending] = useActionState(
    assignPlanAction,
    {} as AdminActionState,
  );
  return (
    <form action={action} className="mt-3 space-y-2">
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="targetUserId" value={userId} />
      <label className="block text-sm">
        Assign plan (pilot override)
        <select
          name="plan"
          defaultValue={currentPlan ?? "member_access"}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          {CATALOG_PLAN_IDS.map((id) => (
            <option key={id} value={id}>
              {PLAN_CATALOG[id].label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full border border-line px-4 text-sm disabled:opacity-60"
      >
        {pending ? "Saving…" : "Assign for 30 days"}
      </button>
    </form>
  );
}
