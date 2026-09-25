"use client";

import { useActionState } from "react";
import { assignCoachAction, type StaffActionState } from "@/app/actions/staff";
import { StatusBanner } from "@/components/StatusBanner";

type Person = { id: string; email: string; role: string };

export function AssignCoachForm({
  coaches,
  members,
}: {
  coaches: Person[];
  members: Person[];
}) {
  const [state, action, pending] = useActionState(
    assignCoachAction,
    {} as StaffActionState,
  );
  if (coaches.length === 0 || members.length === 0) {
    return (
      <p className="text-sm text-muted">
        Need at least one coach-role account and one member to assign.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <StatusBanner error={state.error} success={state.success} />
      <label className="block text-sm">
        Coach
        <select
          name="coachUserId"
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          {coaches.map((row) => (
            <option key={row.id} value={row.id}>
              {row.email} ({row.role})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Member
        <select
          name="memberUserId"
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          {members.map((row) => (
            <option key={row.id} value={row.id}>
              {row.email}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Assign"}
      </button>
    </form>
  );
}
