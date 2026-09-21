"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { createBookingRequestForUser } from "@/lib/bookings";
import { publicErrorMessage } from "@/lib/errors";

export type BookingActionState = { error?: string; success?: string };

export async function createBookingRequestAction(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  try {
    const user = await requireUserOrThrow();
    await createBookingRequestForUser(user.id, {
      kind: String(formData.get("kind") ?? ""),
      preferredTimes: String(formData.get("preferredTimes") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/book");
    revalidatePath("/admin/plans");
    return {
      success:
        "Request sent. This is not a confirmed calendar slot and does not charge a card.",
    };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
