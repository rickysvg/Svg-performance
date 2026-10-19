import Image from "next/image";
import Link from "next/link";

const ART = "/tiles/sparring.webp";
const ALT = "Two fighters sparring, one throwing a punch and the other a knee";

const LABEL = "Sparring Log";

export function SparringLogTile({
  hint,
  layout = "card",
}: {
  hint: string;
  layout?: "card" | "row";
}) {
  if (layout === "row") {
    return (
      <Link
        href="/sparring"
        data-sparring-tile
        data-sparring-layout="row"
        className="flex min-w-0 items-center gap-3 rounded-[1.25rem] bg-black px-3 py-3 text-white"
      >
        <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-black">
          <Image src={ART} alt="" fill sizes="64px" className="object-cover object-center" />
        </span>
        <span className="min-w-0">
          <span className="font-display block text-lg uppercase leading-tight tracking-wide">
            {LABEL}
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-medium text-white/80" data-sparring-hint>
            {hint}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/sparring"
      data-sparring-tile
      data-sparring-layout="card"
      className="relative block min-w-0 w-full aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-black ring-1 ring-[#cbf805]/40"
    >
      <Image
        src={ART}
        alt={ALT}
        fill
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
          {LABEL}
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-white/80" data-sparring-hint>
          {hint}
        </span>
      </span>
    </Link>
  );
}
