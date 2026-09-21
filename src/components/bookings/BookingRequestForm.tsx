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
      <label className="block text-sm">
        Session
        <select
          name="kind"
          defaultValue={defaultKind}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {BOOKING_OFFERS[kind].label} · {BOOKING_OFFERS[kind].priceLabel}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Preferred days or times
        <textarea
          name="preferredTimes"
          required
          rows={3}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          placeholder="Example: Tue/Thu after 5pm El Paso time. This is a request, not a booked slot."
        />
      </label>
      <label className="block text-sm">
        Note
        <textarea
          name="note"
          rows={3}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
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
