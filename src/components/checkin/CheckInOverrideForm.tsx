"use client";

import { useActionState } from "react";
import { setCheckInOverrideAction, type CheckInActionState } from "@/app/actions/weekly-checkin";
import { StatusBanner } from "@/components/StatusBanner";

export function CheckInOverrideForm({
  enabled,
}: {
  enabled: Array<{ email: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(setCheckInOverrideAction, {} as CheckInActionState);
  return (
    <section className="rounded-3xl border border-line bg-card px-4 py-4">
      <h2 className="text-xl">Testing access</h2>
      <p className="mt-1 text-sm text-muted">
        Weekly check-ins are on 1-on-1 Coaching with Ricky. Older coaching plans still count.
        Turn one account on here when you need to test.
      </p>
      <div className="mt-3">
        <StatusBanner error={state.error} success={state.success} />
      </div>
      <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          name="email"
          type="email"
          required
          placeholder="member@email.com"
          className="min-h-11 flex-1 rounded-full border border-line bg-white px-4"
        />
        <button
          type="submit"
          name="enabled"
          value="1"
          disabled={pending}
          className="min-h-11 rounded-full bg-accent px-4 text-black disabled:opacity-60"
        >
          Enable
        </button>
      </form>
      {enabled.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {enabled.map((row) => (
            <li key={row.email} className="flex items-center justify-between gap-3">
              <span>
                {row.name}
                <span className="text-muted"> · {row.email}</span>
              </span>
              <form action={action}>
                <input type="hidden" name="email" value={row.email} />
                <button
                  type="submit"
                  name="enabled"
                  value="0"
                  className="min-h-11 rounded-full border border-black px-3"
                >
                  Turn off
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
