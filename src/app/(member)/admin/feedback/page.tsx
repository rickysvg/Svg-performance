import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isFeedbackAdmin } from "@/lib/feedback-access";
import { listMemberFeedback } from "@/lib/feedback";
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
  const rows = await listMemberFeedback(user, { type, status });

  return (
    <main className="space-y-6" data-feedback-inbox="1">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted">Admin</p>
        <h1 className="text-2xl">Feedback</h1>
        <p className="mt-2 text-sm text-muted">
          Notes from members. Screenshots stay private to admin accounts and emails in ADMIN_EMAILS.
        </p>
      </div>
      <p className="text-sm">
        <Link href="/admin" className="font-semibold underline">
          Pilot toolkit
        </Link>
      </p>

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
          {rows.map((row) => (
            <li key={row.id} className="rounded-[1.5rem] border border-line bg-white px-4 py-4" data-feedback-row={row.id}>
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
          ))}
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
