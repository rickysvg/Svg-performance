import Link from "next/link";

function SparringGlovesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden focusable="false">
      <g fill="currentColor">
        <ellipse cx="16" cy="15" rx="11" ry="12" />
        <ellipse cx="25" cy="22" rx="5.5" ry="4.2" />
        <rect x="7" y="22" width="15" height="14" rx="3.5" />
        <ellipse cx="48" cy="15" rx="11" ry="12" />
        <ellipse cx="39" cy="22" rx="5.5" ry="4.2" />
        <rect x="42" y="22" width="15" height="14" rx="3.5" />
      </g>
      <g fill="white">
        <rect x="9.5" y="27" width="10" height="2.4" rx="1" />
        <rect x="44.5" y="27" width="10" height="2.4" rx="1" />
      </g>
    </svg>
  );
}

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
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#CBF805] text-black">
          <SparringGlovesIcon className="h-7 w-11" />
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
      className="relative block aspect-[4/3] min-w-0 w-full overflow-hidden rounded-[1.25rem] bg-black text-white"
    >
      <span className="absolute inset-x-0 top-2 flex h-[52%] items-end justify-center text-[#CBF805]">
        <SparringGlovesIcon className="h-12 w-20" />
      </span>
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"
      />
      <span className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8">
        <span aria-hidden className="mb-1.5 block h-0.5 w-6 rounded-full bg-[#CBF805]" />
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
