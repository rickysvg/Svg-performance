import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://svgperformance.app";
  const paths = ["/", "/privacy", "/terms", "/support", "/delete-account", "/pricing", "/login", "/register"];
  return paths.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified: new Date("2026-11-24"),
  }));
}
