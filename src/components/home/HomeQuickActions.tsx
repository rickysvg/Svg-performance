import Image from "next/image";
import Link from "next/link";
import { FormCheckLockedTrigger } from "@/components/form-check/FormCheckLockedSheet";
import { SparringLogTile } from "@/components/home/SparringLogTile";
import { UpgradePreviewSheet } from "@/components/upgrade/UpgradePreviewSheet";
import { tileSrc } from "@/lib/athlete-imagery";
import { sparringTileHint } from "@/lib/sparring-tile";

const PHOTO_ACTIONS = [
  {
    href: "/training",
    label: "Train",
    hint: "Today’s work",
    src: "/tiles/train.webp",
    alt: "Athlete deadlifting a barbell beside an athlete on an assault bike",
  },
  {
    href: "/bagwork",
    label: "Bagwork",
    hint: "Heavy bag rounds",
    src: "/tiles/bagwork.webp",
    alt: "Athlete hitting a heavy bag in a dark gym",
  },
  {
    href: "/mobility",
    label: "Mobility",
    hint: "Hips and holds",
    src: "/tiles/mobility.webp",
    alt: "Athlete stretching the hips on a dark gym floor",
  },
  {
    href: "/coach",
    label: "Coach",
    hint: "Ask SVG Coach",
    src: "/tiles/coach.webp",
    alt: "Coach holding mitts in a dark gym",
  },
  {
    href: "/form-check",
    label: "Form check",
    hint: "Send a clip",
    src: "/tiles/form-check.webp",
    alt: "Athlete filming a form check in a dark gym",
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
  action: {
    href: string;
    label: string;
    hint: string;
    src: string;
    alt: string;
  };
}) {
  return (
    <>
      <Image
        src={action.src}
        alt={action.alt}
        fill
        priority={action.href === "/training"}
        sizes="(max-width: 390px) 50vw, (max-width: 640px) 45vw, 320px"
        className="object-cover object-center"
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
      />
      <span aria-hidden className="hc-corners" />
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
  sparringRating = null,
  imagery = "",
  formCheckLocked = false,
}: {
  locked?: { href: string; kind: "fuel" | "coach" }[];
  canStartTrial?: boolean;
  trialDays?: number;
  sparringRating?: number | null;
  imagery?: string | null;
  formCheckLocked?: boolean;
}) {
  const lockedMap = new Map(locked.map((item) => [item.href, item.kind]));
  return (
    <section className="min-w-0">
      <div className="grid grid-cols-2 gap-3">
        {PHOTO_ACTIONS.map((action) => {
          const art = { ...action, src: tileSrc(action.src, imagery) };
          const kind = lockedMap.get(action.href);
          const className =
            "relative block min-w-0 w-full aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-black ring-1 ring-[#cbf805]/40";
          if (action.href === "/form-check" && formCheckLocked) {
            return (
              <FormCheckLockedTrigger
                key={action.href}
                testId="form-check-locked-trigger-home"
                className={`${className} border-0 p-0 text-left font-inherit`}
              >
                <ActionTile action={art} />
              </FormCheckLockedTrigger>
            );
          }
          if (kind) {
            return (
              <UpgradePreviewSheet
                key={action.href}
                kind={kind}
                canStartTrial={canStartTrial}
                trialDays={trialDays}
                next={action.href}
              >
                <span className={className} data-home-tile-locked={kind}>
                  <ActionTile action={art} />
                  <span className="absolute top-2 right-2 z-10 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#CBF805]">
                    Pro
                  </span>
                </span>
              </UpgradePreviewSheet>
            );
          }
          return (
            <Link data-testid={`home-link-${action.href.split("/").filter(Boolean).join("-")}`} key={action.href} href={action.href} className={className}>
              <ActionTile action={art} />
            </Link>
          );
        })}
        <SparringLogTile hint={sparringTileHint(sparringRating)} src={tileSrc("/tiles/sparring.webp", imagery)} />
      </div>
    </section>
  );
}
