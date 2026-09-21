"use client";

import { useActionState } from "react";
import { markCreditUsedAction, type AdminActionState } from "@/app/actions/admin";
import { StatusBanner } from "@/components/StatusBanner";
import { CREDIT_KINDS, CREDIT_LABELS } from "@/lib/plans";

export function AdminCreditForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(
    markCreditUsedAction,
    {} as AdminActionState,
  );
  return (
    <form action={action} className="mt-3 space-y-2">
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="targetUserId" value={userId} />
      <label className="block text-sm">
        Mark credit used
        <select
          name="kind"
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          {CREDIT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {CREDIT_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full border border-line px-4 text-sm disabled:opacity-60"
      >
        {pending ? "Saving…" : "Use one credit"}
      </button>
    </form>
  );
}
