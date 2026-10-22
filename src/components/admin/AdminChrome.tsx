import type { ReactNode } from "react";
import Link from "next/link";
import { deskSurfaceClass, type DeskTone } from "@/lib/admin-desk-status";

export function AdminBack({
  href = "/admin",
  label = "Admin",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      data-testid={`chrome-link-2-${href.split("/").filter(Boolean).join("-")}`}
      href={href}
      className="inline-flex min-h-11 items-center gap-1.5 font-telemetry text-[11px] uppercase tracking-[0.18em] text-[#CBF805]"
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
        <path
          d="M10 3 5 8l5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </Link>
  );
}

export function AdminScreen({
  backHref = "/admin",
  backLabel = "Admin",
  kicker,
  title,
  hint,
  children,
}: {
  backHref?: string;
  backLabel?: string;
  kicker?: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <main className="space-y-5 pb-4">
      <AdminBack href={backHref} label={backLabel} />
      <header>
        {kicker ? <p className="hc-kicker">{kicker}</p> : null}
        <h1 className="mt-2 text-4xl">{title}</h1>
        {hint ? <p className="mt-2 max-w-md text-sm text-muted">{hint}</p> : null}
      </header>
      {children}
    </main>
  );
}

export function AdminStat({
  label,
  value,
  tone = "idle",
}: {
  label: string;
  value: string;
  tone?: DeskTone;
}) {
  const ink =
    tone === "attention" ? "text-[#FF3B3B]" : tone === "clear" ? "text-[#CBF805]" : "text-white";
  return (
    <div className={`hc-panel px-4 py-4 ${deskSurfaceClass(tone)}`} data-desk-tone={tone}>
      <p className="font-telemetry text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`font-telemetry mt-2 text-3xl ${ink}`}>{value}</p>
    </div>
  );
}

export function AdminToolkit({
  links,
}: {
  links: { href: string; label: string; hint: string }[];
}) {
  if (links.length === 0) return null;
  return (
    <section className="space-y-2">
      <p className="hc-kicker">Also here</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link data-testid={`chrome-link-3-${link.href.split("/").filter(Boolean).join("-")}`} href={link.href} className="hc-panel flex min-h-16 items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="font-display block text-lg uppercase leading-tight tracking-wide">
                  {link.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{link.hint}</span>
              </span>
              <span aria-hidden className="text-[#CBF805]">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
