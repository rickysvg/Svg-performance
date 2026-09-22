"use client";

import { useActionState } from "react";
import {
  createBookingRequestAction,
  type BookingActionState,
} from "@/app/actions/bookings";
import { StatusBanner } from "@/components/StatusBanner";
import { BOOKING_OFFERS, type BookingKind } from "@/lib/plans";

export function BookingRequestForm({
  kinds,
  defaultKind,
}: {
  kinds: BookingKind[];
  defaultKind: BookingKind;
}) {
  const [state, action, pending] = useActionState(
    createBookingRequestAction,
    {} as BookingActionState,
  );
  return (
    <form action={action} className="space-y-3">
      <StatusBanner error={state.error} success={state.success} />
      <label className="block space-y-2 text-sm">
        <span>Session</span>
        <select
          name="kind"
          defaultValue={defaultKind}
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {BOOKING_OFFERS[kind].label} · {BOOKING_OFFERS[kind].priceLabel}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm">
        <span>Preferred days or times</span>
        <textarea
          name="preferredTimes"
          required
          rows={3}
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
          placeholder="Example: Tue/Thu after 5pm El Paso time. This is a request, not a booked slot."
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Note</span>
        <textarea
          name="note"
          rows={3}
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
          placeholder="What should Ricky know? No promised business results."
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
