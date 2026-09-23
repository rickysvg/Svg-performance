import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
      { protocol: "https", hostname: "img.youtube.com", pathname: "/vi/**" },
    ],
  },
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
