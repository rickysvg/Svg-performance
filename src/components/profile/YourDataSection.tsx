import Link from "next/link";
import { supportEmail } from "@/lib/support";

export function YourDataSection({ locked = false }: { locked?: boolean }) {
  return (
    <section
      data-your-data
      className="space-y-4 rounded-2xl border border-line bg-card p-5"
    >
      <div>
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">
          Privacy
        </p>
        <h2 className="mt-1 text-2xl">Your data</h2>
        <p className="mt-2 text-sm text-muted">
          {locked
            ? `Downloads stay off while training is locked. Email ${supportEmail()} to ask for a copy of your data. You can still delete the account.`
            : "Download a copy of everything this account stores, or delete the account for good. This is your record — not anyone else’s."}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {locked ? null : (
          <a
            href="/api/account/export"
            className="touch-target inline-flex items-center justify-center rounded-full bg-accent px-5 text-base text-black"
          >
            Download my data
          </a>
        )}
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
