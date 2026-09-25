import Link from "next/link";

export function YourDataSection() {
  return (
    <section
      data-your-data
      className="space-y-4 rounded-2xl border border-line bg-card p-5"
    >
      <div>
        <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Privacy
        </p>
        <h2 className="mt-1 text-2xl font-semibold">Your data</h2>
        <p className="mt-2 text-sm text-muted">
          Download a copy of everything this account stores, or delete the account
          for good. This is your record — not anyone else’s.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <a
          href="/api/account/export"
          className="touch-target inline-flex items-center justify-center rounded-full bg-accent px-5 text-base font-semibold text-black"
        >
          Download my data
        </a>
        <Link
          href="/profile/delete"
          className="touch-target inline-flex items-center justify-center rounded-full bg-danger px-5 text-base font-semibold text-white"
        >
          Delete account
        </Link>
      </div>
    </section>
  );
}
