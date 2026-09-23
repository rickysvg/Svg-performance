import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { CalendarList } from "@/components/training/CalendarList";
import { requireUser } from "@/lib/session";
import { getCalendarSchedule } from "@/lib/calendar";

export default async function TrainingCalendarPage() {
  const user = await requireUser();
  const schedule = await getCalendarSchedule(user.id);

  return (
    <main className="space-y-6">
      <div>
        <Link href="/training" className="text-sm text-accent underline-offset-4 hover:underline">
          Back to Training
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Calendar</h1>
            <p className="mt-1 text-sm text-muted">
              Core week plan (DEMO) from your availability
              {schedule.programTitle ? ` · ${schedule.programTitle}` : ""}. Not a live
              coach calendar, Watch sync, or Gymdesk.
            </p>
          </div>
          <DemoBadge />
        </div>
      </div>

      {schedule.days.every((day) => day.activities.every((item) => item.kind !== "workout")) ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
          DEMO training days are not loaded on this preview yet. Your account is fine. Open
          Training when the template is seeded.
        </p>
      ) : null}

      <CalendarList days={schedule.days} />
    </main>
  );
}
