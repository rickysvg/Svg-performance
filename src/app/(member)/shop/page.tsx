import {
  SHOP_HOME,
  SHOP_PRODUCTS,
  SHOP_RASHGUARDS,
  VERIFIED_PRODUCT_LINKS,
} from "@/lib/shop";

export default function ShopPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl">Shop</h1>
        <p className="mt-2 text-sm text-muted">
          SVG Performance does not sell gear and does not list prices or stock.
          Everything below opens the live SVG &amp; CO store in a new tab.
        </p>
      </div>

      <section className="space-y-3">
        <a
          href={SHOP_PRODUCTS}
          target="_blank"
          rel="noreferrer"
          className="touch-target flex items-center justify-center rounded-full bg-accent text-black"
        >
          Browse all products on svgandco.com
        </a>
        <a
          href={SHOP_RASHGUARDS}
          target="_blank"
          rel="noreferrer"
          className="touch-target flex items-center justify-center rounded-full border border-line"
        >
          Rashguards category
        </a>
        <a
          href={SHOP_HOME}
          target="_blank"
          rel="noreferrer"
          className="touch-target flex items-center justify-center rounded-full border border-line"
        >
          SVG &amp; CO home
        </a>
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2>Verified product pages</h2>
        <p className="mt-1 text-sm text-muted">
          Names only. Check the store for current price, size, and availability.
        </p>
        <ul className="mt-4 space-y-3">
          {VERIFIED_PRODUCT_LINKS.map((product) => (
            <li key={product.href}>
              <a
                href={product.href}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline-offset-4 hover:underline"
              >
                {product.name}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
