import Image from "next/image";
import Link from "next/link";

const PHOTO_ACTIONS = [
  {
    href: "/training",
    label: "Train",
    hint: "Today’s work",
    src: "/tiles/train.webp",
    alt: "Athlete punching a heavy bag",
  },
  {
    href: "/coach",
    label: "Coach",
    hint: "Ask SVG Coach",
    src: "/tiles/coach.webp",
    alt: "Coach holding mitts in a dark gym",
  },
  {
    href: "/learn",
    label: "Learn",
    hint: "Technique",
    src: "/tiles/learn.webp",
    alt: "Two athletes drilling a takedown",
  },
  {
    href: "/progress",
    label: "Progress",
    hint: "PRs + photos",
    src: "/tiles/progress.webp",
    alt: "Athlete standing after a session",
  },
] as const;

const TEXT_ACTIONS = [
  { href: "/nutrition", label: "Fuel", hint: "Log food" },
  { href: "/training/calendar", label: "Calendar", hint: "This week" },
] as const;

export function HomeQuickActions() {
  return (
    <section className="min-w-0 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {PHOTO_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="relative block min-w-0 w-full aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-black"
          >
            <Image
              src={action.src}
              alt={action.alt}
              fill
              sizes="(max-width: 390px) 50vw, (max-width: 640px) 45vw, 320px"
              className="object-cover object-center"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
            />
            <span className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8">
              <span aria-hidden className="mb-1.5 block h-0.5 w-6 rounded-full bg-accent" />
              <span className="font-display block text-lg font-bold uppercase leading-tight tracking-wide text-white">
                {action.label}
              </span>
              <span className="mt-0.5 block text-[11px] font-medium text-white/80">
                {action.hint}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TEXT_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex min-h-[5.5rem] min-w-0 w-full flex-col justify-between rounded-2xl border border-line bg-card px-3 py-3"
          >
            <span className="font-display inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-black">
              {action.label.slice(0, 1)}
            </span>
            <span>
              <span className="font-display block text-sm font-semibold uppercase tracking-wide">{action.label}</span>
              <span className="mt-0.5 block text-[11px] text-muted">{action.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
