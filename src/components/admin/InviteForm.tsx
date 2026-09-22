"use client";

import { useActionState } from "react";
import { createInviteAction, type AdminActionState } from "@/app/actions/admin";
import { StatusBanner } from "@/components/StatusBanner";

export function InviteForm() {
  const [state, action, pending] = useActionState(createInviteAction, {} as AdminActionState);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-semibold">Invite an email</h2>
      <StatusBanner error={state.error} success={state.success} />
      <input
        name="email"
        type="email"
        required
        placeholder="athlete@example.com"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <input
        name="note"
        placeholder="Optional note"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full bg-accent px-5 font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add invite"}
      </button>
    </form>
  );
}
