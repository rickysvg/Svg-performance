import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOME_SHOP_PRODUCTS,
  SHOP_BIG_BOSS_RASHGUARD,
  SHOP_FLAME_SHORTS,
  SHOP_MMA_GLOVES,
  SHOP_PRODUCTS,
} from "@/lib/shop";

const FILES = ["mma-gloves.webp", "flame-shorts.webp", "big-boss-rashguard.webp"] as const;

describe("Home shop promo", () => {
  it("ships ~600px WebP product shots under 60KB", () => {
    for (const name of FILES) {
      const file = path.join(process.cwd(), "public/shop", name);
      expect(fs.existsSync(file), file).toBe(true);
      const bytes = fs.readFileSync(file);
      expect(bytes[0]).toBe(0x52);
      expect(bytes[8]).toBe(0x57);
      expect(bytes[9]).toBe(0x45);
      expect(bytes[10]).toBe(0x42);
      expect(bytes[11]).toBe(0x50);
      expect(bytes.length).toBeGreaterThan(8_000);
      expect(bytes.length).toBeLessThan(60_000);
    }
  });

  it("lists the three live SVG & CO product URLs as constants", () => {
    expect(SHOP_MMA_GLOVES).toBe(
      "https://www.svgandco.com/product/decoder-mma-hybrid-sparring-gloves",
    );
    expect(SHOP_FLAME_SHORTS).toBe(
      "https://www.svgandco.com/product/destined-hunter-training-shorts",
    );
    expect(SHOP_BIG_BOSS_RASHGUARD).toBe(
      "https://www.svgandco.com/product/big-boss-rashguard",
    );
    expect(SHOP_PRODUCTS).toBe("https://www.svgandco.com/products");
    expect(HOME_SHOP_PRODUCTS.map((row) => row.href)).toEqual([
      SHOP_MMA_GLOVES,
      SHOP_FLAME_SHORTS,
      SHOP_BIG_BOSS_RASHGUARD,
    ]);
  });

  it("renders local next/image cards without silhouettes, prices, or hotlinks", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/home/HomeMerchPromo.tsx"),
      "utf8",
    );
    expect(source).toContain('from "next/image"');
    expect(source).toContain("<Image");
    expect(source).toContain('sizes="(max-width: 390px) 30vw, (max-width: 640px) 28vw, 180px"');
    expect(source).toContain("product.shortName");
    expect(source).toContain("Tap to shop on svgandco.com");
    expect(HOME_SHOP_PRODUCTS.map((row) => row.shortName)).toEqual([
      "MMA GLOVES",
      "FLAME SHORTS",
      "BIG BOSS RASHGUARD",
    ]);
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noreferrer"');
    expect(source).toContain("min-h-11");
    expect(source).toContain("min-w-0");
    expect(source).toContain("SHOP_PRODUCTS");
    expect(source).not.toContain("<svg");
    expect(source).not.toMatch(/bigcartel|assets\.bigcartel/i);
    expect(source).not.toMatch(/\$|price|USD/i);
    expect(source).not.toMatch(/function Tee|function Hoodie|function Cap/);
  });

  it("lets /shop/*.webp through the auth proxy so next/image can read them", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(source).toContain("PUBLIC_FILE");
    expect(source).toContain("webp");
  });
});

