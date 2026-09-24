import Image from "next/image";
import { HOME_SHOP_PRODUCTS, SHOP_PRODUCTS } from "@/lib/shop";

export function HomeMerchPromo() {
  return (
    <section className="relative min-w-0 overflow-hidden rounded-[2rem] bg-accent px-5 py-8 text-black">
      <p className="font-display text-2xl font-semibold uppercase leading-tight tracking-wide">
        Check the new SVG &amp; CO collection
      </p>
      <p className="mt-2 max-w-xs text-sm">
        Gear from SVG &amp; CO. Tap to shop on svgandco.com.
      </p>
      <div className="mt-6 grid min-w-0 grid-cols-3 gap-2">
        {HOME_SHOP_PRODUCTS.map((product) => (
          <a
            key={product.href}
            href={product.href}
            target="_blank"
            rel="noreferrer"
            className="relative block min-h-11 min-w-0 overflow-hidden rounded-2xl bg-black"
          >
            <span className="relative block aspect-square">
              <Image
                src={product.src}
                alt={product.alt}
                fill
                sizes="(max-width: 390px) 30vw, (max-width: 640px) 28vw, 180px"
                className="object-cover object-center"
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"
              />
              <span className="absolute inset-x-0 bottom-0 px-1.5 pb-2 pt-6">
                <span className="font-display block text-[10px] font-semibold uppercase leading-tight tracking-wide text-white">
                  {product.shortName}
                </span>
              </span>
            </span>
          </a>
        ))}
      </div>
      <a
        href={SHOP_PRODUCTS}
        target="_blank"
        rel="noreferrer"
        className="font-display touch-target mt-6 inline-flex items-center justify-center rounded-full bg-black px-6 text-sm font-semibold uppercase tracking-[0.08em] text-highlighter"
      >
        Shop now
      </a>
    </section>
  );
}
