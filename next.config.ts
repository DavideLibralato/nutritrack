import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  // Evita che il browser/CDN mettano in cache il file del service worker:
  // altrimenti dopo un deploy gli utenti continuerebbero a usare la versione vecchia.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;