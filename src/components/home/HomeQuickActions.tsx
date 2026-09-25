import Image from "next/image";
import Link from "next/link";
import { UpgradePreviewSheet } from "@/components/upgrade/UpgradePreviewSheet";

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
  {
    href: "/nutrition",
    label: "Fuel",
    hint: "Log food",
    src: "/tiles/fuel.webp",
    alt: "Athlete eating a meal-prep container in a dark gym",
  },
  {
    href: "/training/calendar",
    label: "Calendar",
    hint: "This week",
    src: "/tiles/calendar.webp",
    alt: "Athlete checking off training days on a whiteboard",
  },
] as const;

function ActionTile({
  action,
}: {
  action: (typeof PHOTO_ACTIONS)[number];
}) {
  return (
    <>
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
        <span className="font-display block text-lg uppercase leading-tight tracking-wide text-white">
          {action.label}
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-white/80">
          {action.hint}
        </span>
      </span>
    </>
  );
}

export function HomeQuickActions({
  locked = [],
  canStartTrial = false,
  trialDays = 7,
}: {
  locked?: { href: string; kind: "fuel" | "coach" }[];
  canStartTrial?: boolean;
  trialDays?: number;
}) {
  const lockedMap = new Map(locked.map((item) => [item.href, item.kind]));
  return (
    <section className="min-w-0">
      <div className="grid grid-cols-2 gap-3">
        {PHOTO_ACTIONS.map((action) => {
          const kind = lockedMap.get(action.href);
          const className =
            "relative block min-w-0 w-full aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-black";
          if (kind) {
            return (
              <UpgradePreviewSheet
                key={action.href}
                kind={kind}
                canStartTrial={canStartTrial}
                trialDays={trialDays}
                next={action.href}
              >
                <span className={className}>
                  <ActionTile action={action} />
                </span>
              </UpgradePreviewSheet>
            );
          }
          return (
            <Link key={action.href} href={action.href} className={className}>
              <ActionTile action={action} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
