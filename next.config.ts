import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables forbidden() and forbidden.tsx for permission failures.
  experimental: { authInterrupts: true },
  images: {
    // Media is served from the storage address set in Settings > File storage,
    // which can change while the server runs, so any https host is accepted.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
