import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables forbidden() and forbidden.tsx for permission failures.
  experimental: { authInterrupts: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
};

export default nextConfig;
