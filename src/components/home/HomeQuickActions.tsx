import Link from "next/link";

const PHOTO_ACTIONS = [
  {
    href: "/training",
    label: "Train",
    hint: "Today’s work",
    src: "/home/tiles/train.jpg",
    alt: "Sparring at SVG MMA Academy",
    position: "center 32%",
  },
  {
    href: "/coach",
    label: "Coach",
    hint: "Ask SVG Coach",
    src: "/home/tiles/coach.jpg",
    alt: "Coach pointing on the mats at SVG",
    position: "70% 22%",
  },
  {
    href: "/learn",
    label: "Learn",
    hint: "Technique",
    src: "/home/tiles/learn.jpg",
    alt: "Pad work in the cage at SVG",
    position: "center 42%",
  },
  {
    href: "/progress",
    label: "Progress",
    hint: "PRs + photos",
    src: "/home/tiles/progress.jpg",
    alt: "Walkout under the lights",
    position: "center 30%",
  },
] as const;

const TEXT_ACTIONS = [
  { href: "/nutrition", label: "Fuel", hint: "Log food" },
  { href: "/training/calendar", label: "Calendar", hint: "This week" },
] as const;

export function HomeQuickActions() {
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {PHOTO_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="relative block aspect-[4/3] min-h-[9.5rem] overflow-hidden rounded-[1.25rem] bg-black"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static academy photos in /public */}
            <img
              src={action.src}
              alt={action.alt}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: action.position }}
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
            className="flex min-h-[5.5rem] flex-col justify-between rounded-2xl border border-line bg-card px-3 py-3"
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
