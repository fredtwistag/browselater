/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    serverComponentsExternalPackages: [
      "pdf-parse",
      "@mozilla/readability",
      "jsdom",
      "playwright",
    ],
    // Browser View Transitions API: smooth feed card → detail morph. Falls back to
    // opacity transitions on browsers without support (and is auto-disabled by
    // prefers-reduced-motion via our globals.css rule).
  },
};

export default nextConfig;
