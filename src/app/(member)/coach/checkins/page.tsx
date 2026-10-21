import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isWeeklyCheckInCoach, listCheckInOverrides, listCheckInsForCoach } from "@/lib/weekly-checkin";
import { CheckInOverrideForm } from "@/components/checkin/CheckInOverrideForm";
import { CoachCheckInList } from "@/components/checkin/CoachCheckInList";
import { AdminScreen, AdminToolkit } from "@/components/admin/AdminChrome";
import { DeskBadge } from "@/components/admin/DeskStatus";
import { deskSurfaceClass, queueItemTone } from "@/lib/admin-desk-status";

export default async function CoachCheckInsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requireUser();
  if (!isWeeklyCheckInCoach(user)) redirect("/home");
  const query = await searchParams;
  const [cards, overrides] = await Promise.all([listCheckInsForCoach(), listCheckInOverrides()]);
  const open = cards.filter((card) => card.coachStatus === "pending");
  const answered = cards.filter((card) => card.coachStatus !== "pending");
  const flagged = cards.filter((card) => card.flagCount > 0 && card.coachStatus === "pending").length;
  const selected = query.id ? cards.find((card) => card.id === query.id) : null;
  const toolkit =
    user.role === "admin"
      ? [{ href: "/admin/queues", label: "Comment queues", hint: "Reports, bookings, clips" }]
      : [];

  if (query.id) {
    return (
      <AdminScreen
        backHref="/coach/checkins"
        backLabel="Check-ins"
        kicker="Weekly check-in"
        title={selected?.name ?? "Check-in"}
        hint="Template summary. Approve it or write the reply."
      >
        {selected ? (
          <CoachCheckInList
            cards={[
              {
                id: selected.id,
                name: selected.name,
                email: selected.email,
                weekKey: selected.weekKey,
                submittedLabel: selected.submittedAt.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }),
                bodyweightLb: selected.bodyweightLb,
                sleepQuality: selected.sleepQuality,
                energy: selected.energy,
                stress: selected.stress,
                sessionsCompleted: selected.sessionsCompleted,
                sessionsPlanned: selected.sessionsPlanned,
                sparringSummary: selected.sparringSummary,
                wins: selected.wins,
                struggles: selected.struggles,
                sorenessNotes: selected.sorenessNotes,
                regions: selected.regions,
                summary: selected.summary,
                flags: selected.flags,
                tweaks: selected.tweaks,
                aiSource: selected.aiSource,
                coachStatus: selected.coachStatus,
                reply: selected.reply,
                hasVideo: selected.hasVideo,
              },
            ]}
          />
        ) : (
          <p className="text-sm text-muted">That check-in is not in the queue.</p>
        )}
      </AdminScreen>
    );
  }

  return (
    <AdminScreen
      kicker="Coach Ricky"
      title="Check-ins"
      hint={
        flagged > 0
          ? `${flagged} flagged. Read the template, then approve or reply.`
          : "Template summaries. The live model stays off."
      }
    >
      {cards.length === 0 ? (
        <p className="text-sm text-muted">No check-ins yet. VIP Coaching members send one from Check-in.</p>
      ) : (
        <>
          {open.length === 0 ? <p className="text-sm text-muted">No check-ins waiting.</p> : <CheckInQueue rows={open} />}
          {answered.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-lg">Answered</h2>
              <CheckInQueue rows={answered} />
            </section>
          ) : null}
        </>
      )}

      <details className="hc-panel desk-idle px-4 py-3">
        <summary className="cursor-pointer font-semibold">Testing access</summary>
        <div className="mt-3">
          <CheckInOverrideForm enabled={overrides} />
        </div>
      </details>
      <AdminToolkit links={toolkit} />
    </AdminScreen>
  );
}

function CheckInQueue({
  rows,
}: {
  rows: {
    id: string;
    name: string;
    weekKey: string;
    summary: string;
    flagCount: number;
    coachStatus: string;
  }[];
}) {
  return (
    <ul className="space-y-2">
      {rows.map((card) => {
        const tone = queueItemTone(card.coachStatus !== "pending");
        const label =
          card.coachStatus === "pending"
            ? card.flagCount > 0
              ? `${card.flagCount} flag${card.flagCount === 1 ? "" : "s"}`
              : "Waiting"
            : "Done";
        return (
          <li key={card.id}>
            <Link
              href={`/coach/checkins?id=${card.id}`}
              data-desk-tone={tone}
              className={`hc-panel block px-4 py-4 ${deskSurfaceClass(tone)}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-display block text-xl uppercase leading-tight">{card.name}</span>
                  <span className="mt-1 block text-sm text-muted">Week of {card.weekKey}</span>
                </span>
                <DeskBadge tone={tone} label={label} />
              </span>
              <span className="mt-3 block line-clamp-2 text-sm text-white/80">{card.summary}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
