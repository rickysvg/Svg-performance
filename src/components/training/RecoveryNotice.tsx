export function RecoveryNotice({
  note,
  coachName,
  coachImage,
  message,
}: {
  note?: string | null;
  coachName?: string | null;
  coachImage?: string | null;
  message?: string | null;
}) {
  if (!note && !message) return null;
  return (
    <div className="space-y-3" data-recovery-ease>
      {note ? (
        <p data-recovery-note className="rounded-2xl bg-accent px-4 py-3 text-sm text-black">
          {note}
        </p>
      ) : null}
      {message ? (
        <article data-recovery-checkin className="rounded-2xl border border-black bg-white p-4">
          <div className="flex items-center gap-3">
            {coachImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coachImage}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-accent"
              />
            ) : null}
            <div>
              <p className="font-display text-xs uppercase tracking-wide text-black">
                {coachName || "Coach"}
              </p>
              <p className="text-sm font-semibold text-black">Check-in</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-black">{message}</p>
        </article>
      ) : null}
    </div>
  );
}
