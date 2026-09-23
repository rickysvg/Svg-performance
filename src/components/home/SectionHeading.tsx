import Link from "next/link";

export function SectionHeading({
  title,
  href,
  action = "View all",
}: {
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-foreground"
        >
          {action} →
        </Link>
      ) : null}
    </div>
  );
}
