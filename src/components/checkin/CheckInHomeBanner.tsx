import Link from "next/link";
import { getCheckInHomeState } from "@/lib/weekly-checkin";

export async function CheckInHomeBanner({
  userId,
  now,
  timeZone,
}: {
  userId: string;
  now: Date;
  timeZone: string;
}) {
  const state = await getCheckInHomeState(userId, now, timeZone);
  if (!state.allowed) return null;
  if (!state.due && !state.unseenReply) return null;
  const reply = state.unseenReply;
  if (!reply) {
    return (
      <Link
        href="/checkin"
        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-[#CBF805] px-4 py-3 text-black"
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2 py-0.5 text-xs font-semibold text-[#CBF805]">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
            Due
          </span>
          <span className="text-sm uppercase tracking-wide">Weekly check-in due</span>
        </span>
        <span className="rounded-full bg-black px-3 py-2 text-sm text-[#CBF805]">Open</span>
      </Link>
    );
  }
  return (
    <Link
      href="/checkin"
      className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-black px-4 py-3 text-white"
    >
      <span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-black">Reply</span>
          <span className="text-sm uppercase tracking-wide text-accent">Coach Ricky replied</span>
        </span>
        <span className="mt-1 block text-sm text-white/80">Open it and read the note.</span>
      </span>
      <span className="rounded-full bg-accent px-3 py-2 text-sm text-black">Open</span>
    </Link>
  );
}
