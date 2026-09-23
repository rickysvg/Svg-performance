import Link from "next/link";

const ACTIONS = [
  { href: "/training", label: "Train", hint: "Today’s work" },
  { href: "/nutrition", label: "Fuel", hint: "Log food" },
  { href: "/learn", label: "Learn", hint: "Technique" },
  { href: "/coach", label: "Coach", hint: "Ask SVG Coach" },
  { href: "/training/calendar", label: "Calendar", hint: "This week" },
  { href: "/progress", label: "Progress", hint: "PRs + photos" },
] as const;

export function HomeQuickActions() {
  return (
    <section>
      <div className="grid grid-cols-3 gap-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex min-h-[6.5rem] flex-col justify-between rounded-2xl border border-line bg-card px-3 py-3"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-black">
              {action.label.slice(0, 1)}
            </span>
            <span>
              <span className="block text-sm font-semibold">{action.label}</span>
              <span className="mt-0.5 block text-[11px] text-muted">{action.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
