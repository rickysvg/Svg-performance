import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isFeedbackAdmin } from "@/lib/feedback-access";
import { listMemberFeedback } from "@/lib/feedback";
import { listSessionFeel } from "@/lib/admin-dashboard";
import { AdminBack } from "@/components/admin/AdminChrome";
import {
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABEL,
  feedbackInboxHref,
  feedbackStatusLabel,
  feedbackTypeLabel,
  isFeedbackStatus,
  isFeedbackType,
} from "@/lib/feedback-shared";
import { setFeedbackStatusAction } from "@/app/actions/feedback";
import { DeskBadge } from "@/components/admin/DeskStatus";
import { deskSurfaceClass, queueItemTone } from "@/lib/admin-desk-status";

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const user = await requireUser();
  if (!isFeedbackAdmin(user)) {
    redirect("/home");
  }
  const query = await searchParams;
  const type = query.type && isFeedbackType(query.type) ? query.type : "";
  const status = query.status && isFeedbackStatus(query.status) ? query.status : "";
  const [rows, feel] = await Promise.all([
    listMemberFeedback(user, { type, status }),
    listSessionFeel(),
  ]);

  return (
    <main className="space-y-6" data-feedback-inbox="1">
      <AdminBack />
      <div>
        <p className="hc-kicker">Session feel</p>
        <h1 className="mt-2 text-4xl">Feedback</h1>
        <p className="mt-2 text-sm text-muted">
          Difficulty ratings and flags first. Notes stay private to admin accounts and ADMIN_EMAILS.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg">Flags</h2>
        {feel.flags.length === 0 ? (
          <p className="text-sm text-muted">No difficulty flags in the last three weeks.</p>
        ) : (
          <ul className="space-y-2">
            {feel.flags.map((flag) => (
              <li
                key={`${flag.userId}-${flag.label}`}
                data-desk-tone="attention"
                className={`hc-panel px-4 py-3 ${deskSurfaceClass("attention")}`}
              >
                <p className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{flag.name}</span>
                  <DeskBadge tone="attention" label={flag.label} />
                </p>
                <p className="mt-1 text-sm text-muted">{flag.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Recent ratings</h2>
        {feel.recent.length === 0 ? (
          <p className="text-sm text-muted">No session ratings yet.</p>
        ) : (
          <ul className="space-y-2">
            {feel.recent.map((row) => {
              const tone = row.hard ? "attention" : "idle";
              return (
                <li
                  key={row.id}
                  data-desk-tone={tone}
                  className={`hc-panel flex items-center justify-between gap-3 px-4 py-3 ${deskSurfaceClass(tone)}`}
                >
                  <span>
                    <span className="block font-semibold">{row.name}</span>
                    <span className="text-sm text-muted">{row.title}</span>
                  </span>
                  <span className={`text-right text-sm ${row.hard ? "text-[#FF3B3B]" : "text-[#CBF805]"}`}>
                    {row.label}
                    <span className="mt-0.5 block font-telemetry text-[10px] uppercase text-muted">{row.when}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {user.role === "admin" || user.role === "coach" ? (
        <p className="text-sm">
          <Link href="/staff/reports#session-feel" className="text-[#CBF805] underline">
            Full session feel report
          </Link>
        </p>
      ) : null}

      <h2 className="text-lg">Member notes</h2>

      <section className="space-y-3">
        <FilterRow
          label="Type"
          current={type}
          param="type"
          otherStatus={status}
          options={[{ value: "", label: "All" }, ...FEEDBACK_TYPES.map((value) => ({ value, label: FEEDBACK_TYPE_LABEL[value] }))]}
        />
        <FilterRow
          label="Status"
          current={status}
          param="status"
          otherType={type}
          options={[
            { value: "", label: "All" },
            ...FEEDBACK_STATUSES.map((value) => ({ value, label: FEEDBACK_STATUS_LABEL[value] })),
          ]}
        />
      </section>

      {rows.length === 0 ? (
        <p className="rounded-[1.5rem] border border-line bg-card px-4 py-4 text-sm text-muted">
          No feedback in this filter.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => {
            const tone = queueItemTone(row.status !== "new");
            return (
            <li
              key={row.id}
              className={`rounded-[1.5rem] border bg-white px-4 py-4 ${
                tone === "attention"
                  ? "border-[#FF3B3B] shadow-[0_0_16px_rgba(255,59,59,0.35)]"
                  : "border-[#CBF805] shadow-[0_0_16px_rgba(203,248,5,0.28)]"
              }`}
              data-feedback-row={row.id}
              data-desk-tone={tone}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-display text-lg uppercase tracking-wide">{feedbackTypeLabel(row.type)}</p>
                <p className="rounded-full bg-black px-3 py-1 text-xs text-[#cbf805]">
                  {feedbackStatusLabel(row.status)}
                </p>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{row.message}</p>
              <dl className="mt-3 space-y-1 text-xs text-muted">
                <div>
                  <dt className="inline">From </dt>
                  <dd className="inline">
                    {row.user.profile?.displayName || row.userEmail} · {row.user.email} · {row.userId}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Page </dt>
                  <dd className="inline">{row.route || "—"}</dd>
                </div>
                {row.workoutId ? (
                  <div>
                    <dt className="inline">Workout </dt>
                    <dd className="inline">{row.workoutId}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="inline">App </dt>
                  <dd className="inline">{row.appVersion || "—"}</dd>
                </div>
                <div>
                  <dt className="inline">Device </dt>
                  <dd className="inline break-all">{row.userAgent || "—"}</dd>
                </div>
                <div>
                  <dt className="inline">Sent </dt>
                  <dd className="inline">{row.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</dd>
                </div>
              </dl>
              {row.storageKey ? (
                <div className="mt-3">
                  {/* Authenticated private screenshot. The optimizer cannot fetch it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/feedback/${row.id}`}
                    alt="Screenshot attached to this feedback"
                    className="max-h-80 w-full rounded-2xl border border-line bg-black object-contain"
                  />
                  <a
                    href={`/api/feedback/${row.id}`}
                    className="mt-2 inline-block text-sm font-semibold underline"
                  >
                    View screenshot
                  </a>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {FEEDBACK_STATUSES.map((next) => (
                  <form key={next} action={setFeedbackStatusAction}>
                    <input type="hidden" name="feedbackId" value={row.id} />
                    <input type="hidden" name="status" value={next} />
                    <button
                      type="submit"
                      disabled={row.status === next}
                      aria-pressed={row.status === next}
                      className={`touch-target rounded-full px-4 text-sm ${
                        row.status === next
                          ? "bg-black text-[#cbf805]"
                          : "border border-line bg-white"
                      }`}
                    >
                      {FEEDBACK_STATUS_LABEL[next]}
                    </button>
                  </form>
                ))}
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function FilterRow({
  label,
  current,
  param,
  options,
  otherType = "",
  otherStatus = "",
}: {
  label: string;
  current: string;
  param: "type" | "status";
  options: { value: string; label: string }[];
  otherType?: string;
  otherStatus?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const type = param === "type" ? option.value : otherType;
          const status = param === "status" ? option.value : otherStatus;
          const active = current === option.value;
          return (
            <Link
              key={option.value || "all"}
              href={feedbackInboxHref({ type, status })}
              aria-current={active ? "true" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm ${
                active ? "bg-black text-[#cbf805]" : "border border-line bg-white"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
