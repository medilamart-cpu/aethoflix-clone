import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TMDb images served directly from image.tmdb.org (no Next.js proxy)
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "livetgtv.lovable.app" },
    ],
  },
  // Embed providers are loaded client-side via iframe; we don't proxy them
  // through Next, we just construct URLs.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
