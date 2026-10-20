import Image from "next/image";
import Link from "next/link";

export type AdminTileIcon = "founding" | "revenue" | "feedback" | "announce";

function Glyph({ icon }: { icon: AdminTileIcon }) {
  if (icon === "founding") {
    return (
      <span className="font-display text-5xl leading-none tracking-wide text-[#CBF805]">40</span>
    );
  }
  if (icon === "revenue") {
    return (
      <svg viewBox="0 0 48 48" width="52" height="52" aria-hidden>
        <path d="M8 34V18M20 34V10M32 34V22M44 34V14" stroke="#CBF805" strokeWidth="3" strokeLinecap="round" />
        <path d="M6 38h36" stroke="#CBF805" strokeWidth="1.5" opacity="0.7" />
      </svg>
    );
  }
  if (icon === "feedback") {
    return (
      <svg viewBox="0 0 48 48" width="52" height="52" aria-hidden>
        <path d="M14 8h14l8 8v24H14V8z" fill="none" stroke="#CBF805" strokeWidth="2" />
        <path d="M28 8v8h8" fill="none" stroke="#CBF805" strokeWidth="2" />
        <path d="M20 28h12M20 34h8" stroke="#CBF805" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" width="52" height="52" aria-hidden>
      <path d="M10 20v8l22 8V12L10 20z" fill="none" stroke="#CBF805" strokeWidth="2" />
      <path d="M36 18a8 8 0 0 1 0 12" fill="none" stroke="#CBF805" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function AdminTile({
  href,
  label,
  hint,
  src,
  alt = "",
  icon,
  badge,
  alert = false,
  wide = false,
}: {
  href: string;
  label: string;
  hint: string;
  src?: string;
  alt?: string;
  icon?: AdminTileIcon;
  badge?: number | null;
  alert?: boolean;
  wide?: boolean;
}) {
  const ring = alert ? "ring-[#FF3B3B]/80" : "ring-[#cbf805]/40";
  return (
    <Link
      href={href}
      data-admin-tile={label}
      className={`relative block min-w-0 w-full overflow-hidden rounded-[1.25rem] bg-black ring-1 ${ring} ${
        wide ? "col-span-2 aspect-[16/9]" : "aspect-[4/3]"
      }`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={wide ? "(max-width: 390px) 100vw, 640px" : "(max-width: 390px) 50vw, 320px"}
          className="object-cover object-center"
        />
      ) : (
        <span className="hc-carbon absolute inset-0" />
      )}
      {icon ? (
        <span className="absolute inset-x-0 top-0 flex h-[58%] items-center justify-center">
          <Glyph icon={icon} />
        </span>
      ) : null}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
      />
      <span aria-hidden className="hc-corners" />
      {badge != null && badge > 0 ? (
        <span
          className={`absolute right-2.5 top-2.5 z-10 min-w-6 rounded-full px-1.5 py-0.5 text-center font-telemetry text-[11px] ${
            alert ? "bg-[#FF3B3B] text-white" : "bg-[#CBF805] text-black"
          }`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8">
        <span aria-hidden className={`mb-1.5 block h-0.5 w-6 rounded-full ${alert ? "bg-[#FF3B3B]" : "bg-accent"}`} />
        <span className="font-display block text-lg uppercase leading-tight tracking-wide text-white">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-white/80">{hint}</span>
      </span>
    </Link>
  );
}
