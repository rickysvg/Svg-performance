import Link from "next/link";
import { requireDashboardAdmin } from "@/lib/admin-access";
import { listAdminMembers } from "@/lib/admin-dashboard";
import { AdminScreen, AdminToolkit } from "@/components/admin/AdminChrome";
import type { AdminWeekDay } from "@/lib/admin-dashboard";
import { deskSurfaceClass, memberListTone } from "@/lib/admin-desk-status";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireDashboardAdmin();
  const query = (await searchParams).q ?? "";
  const members = await listAdminMembers(query);
  const toolkit =
    user.role === "admin"
      ? [
          { href: "/admin/invites", label: "Invites", hint: "Pilot invites" },
          { href: "/admin/plans", label: "Plans and credits", hint: "Assign a plan, mark a credit" },
          { href: "/admin/gymdesk", label: "Gymdesk", hint: "Roster and verify" },
        ]
      : [];

  return (
    <AdminScreen kicker="Roster" title="Members" hint="Plan, academy, last active, streak, and this week.">
      <form action="/admin/members" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Name or email"
          aria-label="Search members"
          className="min-h-12 min-w-0 flex-1 rounded-full border border-[#2a3124] bg-black px-4 text-base"
        />
        <button type="submit" className="min-h-12 rounded-full bg-[#CBF805] px-4 text-black">
          Search
        </button>
      </form>

      {members.length === 0 ? (
        <p className="text-sm text-muted">{query.trim() ? "No members match that." : "No members yet."}</p>
      ) : (
        <ul className="space-y-2">
          {members.map((member) => {
            const tone = member.role === "member" ? memberListTone(member.week) : "idle";
            return (
            <li key={member.id}>
              <Link
                href={`/admin/members/${member.id}`}
                data-desk-tone={tone}
                className={`hc-panel block px-4 py-4 ${deskSurfaceClass(tone)}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="font-display block text-xl uppercase leading-tight">{member.name}</span>
                    <span className="mt-1 block text-sm text-muted">{member.planLabel}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-telemetry text-lg text-[#CBF805]">{member.streak}</span>
                    <span className="block font-telemetry text-[10px] uppercase tracking-wide text-muted">
                      streak
                    </span>
                  </span>
                </span>
                <span className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {member.academy ? (
                    <span className="rounded-full bg-[#CBF805] px-2 py-0.5 text-black">Academy</span>
                  ) : null}
                  {member.role !== "member" ? (
                    <span className="rounded-full border border-white/20 px-2 py-0.5 uppercase text-muted">
                      {member.role}
                    </span>
                  ) : null}
                  <span className="text-muted">Active {member.lastActiveLabel}</span>
                </span>
                <WeekDots days={member.week} />
              </Link>
            </li>
            );
          })}
        </ul>
      )}
      <AdminToolkit links={toolkit} />
    </AdminScreen>
  );
}

function WeekDots({ days }: { days: AdminWeekDay[] }) {
  return (
    <span className="mt-3 flex justify-between gap-1">
      {days.map((day) => (
        <span key={day.key} className="flex flex-1 flex-col items-center gap-1">
          <span className="font-telemetry text-[10px] text-white/50">{day.label}</span>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              day.completed
                ? "bg-[#CBF805]"
                : day.missed
                  ? "bg-[#FF3B3B]"
                  : day.scheduled
                    ? "border border-[#CBF805]"
                    : "bg-white/15"
            }`}
          />
        </span>
      ))}
    </span>
  );
}
