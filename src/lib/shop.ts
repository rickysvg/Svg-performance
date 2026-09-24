/**
 * Shop links verified against live svgandco.com pages during this build.
 * Do not invent products, prices, or stock here. The storefront is the source.
 */
export const SHOP_HOME = "https://www.svgandco.com";
export const SHOP_PRODUCTS = "https://www.svgandco.com/products";
export const SHOP_RASHGUARDS = "https://www.svgandco.com/category/rashguards";
export const SHOP_MMA_GLOVES =
  "https://www.svgandco.com/product/decoder-mma-hybrid-sparring-gloves";
export const SHOP_FLAME_SHORTS =
  "https://www.svgandco.com/product/destined-hunter-training-shorts";
export const SHOP_BIG_BOSS_RASHGUARD =
  "https://www.svgandco.com/product/big-boss-rashguard";

export const HOME_SHOP_PRODUCTS = [
  {
    shortName: "MMA GLOVES",
    name: "Decoder MMA Hybrid Sparring Gloves",
    href: SHOP_MMA_GLOVES,
    src: "/shop/mma-gloves.webp",
    alt: "Decoder MMA hybrid sparring gloves",
  },
  {
    shortName: "FLAME SHORTS",
    name: "Destined Hunter Training Shorts",
    href: SHOP_FLAME_SHORTS,
    src: "/shop/flame-shorts.webp",
    alt: "Destined Hunter training shorts with lime flames",
  },
  {
    shortName: "BIG BOSS RASHGUARD",
    name: "Big Boss Rashguard",
    href: SHOP_BIG_BOSS_RASHGUARD,
    src: "/shop/big-boss-rashguard.webp",
    alt: "Big Boss rashguard",
  },
] as const;

export const VERIFIED_PRODUCT_LINKS = [
  {
    name: "Decoder MMA Hybrid Sparring Gloves",
    href: SHOP_MMA_GLOVES,
  },
  {
    name: "Destined Hunter Training Shorts",
    href: SHOP_FLAME_SHORTS,
  },
  {
    name: "Big Boss Rashguard",
    href: SHOP_BIG_BOSS_RASHGUARD,
  },
  {
    name: "SVG MMA Zebra Edition short-sleeve rashguard",
    href: "https://www.svgandco.com/product/svg-mma-zebra-edition-short-sleeve-rashguard",
  },
  {
    name: "Master Beast rashguard",
    href: "https://www.svgandco.com/product/master-beast-rashguard",
  },
  {
    name: "Supersnake men's rash guard",
    href: "https://www.svgandco.com/product/supersnake-men-s-rash-guard",
  },
  {
    name: "Stripes of Glory crossbody bag",
    href: "https://www.svgandco.com/product/stripes-of-glory-crossbody-bag",
  },
] as const;
