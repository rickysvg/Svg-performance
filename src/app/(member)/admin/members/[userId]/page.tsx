import { notFound } from "next/navigation";
import { requireDashboardAdmin } from "@/lib/admin-access";
import { getAdminMember } from "@/lib/admin-dashboard";
import { AdminScreen } from "@/components/admin/AdminChrome";
import { AdminVerifyForm } from "@/components/admin/AdminVerifyForm";
import { AdminAssignPlanForm } from "@/components/admin/AdminAssignPlanForm";

export default async function AdminMemberPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const actor = await requireDashboardAdmin();
  const { userId } = await params;
  const member = await getAdminMember(userId);
  if (!member) notFound();

  return (
    <AdminScreen
      backHref="/admin/members"
      backLabel="Members"
      kicker={member.planLabel}
      title={member.name}
      hint={member.email}
    >
      <section className="grid grid-cols-3 gap-2">
        <Stat label="Streak" value={String(member.streak)} />
        <Stat label="Active" value={member.lastActiveLabel} />
        <Stat label="Academy" value={member.academy ? "Yes" : "No"} />
      </section>

      <ul className="space-y-2">
        {member.week.map((day) => (
          <li key={day.key} className="hc-panel flex items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="font-telemetry text-[10px] uppercase tracking-[0.14em] text-muted">
                {day.weekday}
              </span>
              <span className="mt-0.5 block text-sm">{day.title}</span>
            </span>
            <span
              className={`font-telemetry text-[11px] uppercase ${
                day.completed ? "text-[#CBF805]" : day.missed ? "text-[#FF3B3B]" : "text-muted"
              }`}
            >
              {day.completed ? "Done" : day.missed ? "Missed" : day.scheduled ? "Planned" : "Rest"}
            </span>
          </li>
        ))}
      </ul>

      {actor.role === "admin" ? (
        <section className="hc-panel space-y-4 px-4 py-4">
          <h2 className="text-lg">Membership and plan</h2>
          <AdminVerifyForm
            userId={member.id}
            verified={member.verified}
            override={member.override}
            note={member.overrideNote}
          />
          <AdminAssignPlanForm userId={member.id} currentPlan={member.currentPlan} />
        </section>
      ) : null}
    </AdminScreen>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="hc-panel px-3 py-3">
      <p className="font-telemetry text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`mt-1 text-lg ${alert ? "text-[#FF3B3B]" : "text-[#CBF805]"}`}>{value}</p>
    </div>
  );
}
