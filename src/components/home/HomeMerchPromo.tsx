import { SHOP_PRODUCTS } from "@/lib/shop";

function Tee() {
  return (
    <svg viewBox="0 0 64 64" className="h-20 w-20 text-black" aria-hidden>
      <path
        d="M12 20 24 14h16l12 6-8 8v24H20V28l-8-8Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

function Hoodie() {
  return (
    <svg viewBox="0 0 64 64" className="h-24 w-24 text-black" aria-hidden>
      <path
        d="M20 16c0-8 8-12 12-12s12 4 12 12l8 6-6 8v24H18V30l-6-8 8-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Cap() {
  return (
    <svg viewBox="0 0 64 48" className="h-14 w-16 text-black" aria-hidden>
      <path d="M10 28c4-12 14-18 22-18s18 6 22 18H10Z" fill="currentColor" />
      <path d="M8 30h36c6 0 10 2 12 4H10c-2 0-3-2-2-4Z" fill="currentColor" />
    </svg>
  );
}

export function HomeMerchPromo() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-accent px-5 py-8 text-black">
      <p className="text-2xl font-semibold leading-tight tracking-tight">
        Check the new SVG &amp; CO collection
      </p>
      <p className="mt-2 max-w-xs text-sm">
        Names only — the live store has price, size, and stock. Not sold inside
        this app.
      </p>
      <div className="mt-6 flex items-end justify-center gap-2">
        <Tee />
        <Hoodie />
        <Cap />
      </div>
      <a
        href={SHOP_PRODUCTS}
        target="_blank"
        rel="noreferrer"
        className="touch-target mt-6 inline-flex items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-highlighter"
      >
        Shop now
      </a>
    </section>
  );
}
