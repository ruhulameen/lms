import type { NextConfig } from "next";

// Media is served from the R2 public URL when it is set.
const r2Host = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL) : null;

const nextConfig: NextConfig = {
  // Enables forbidden() and forbidden.tsx for permission failures.
  experimental: { authInterrupts: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      ...(r2Host
        ? [{ protocol: r2Host.protocol.replace(":", "") as "http" | "https", hostname: r2Host.hostname, port: r2Host.port }]
        : []),
    ],
  },
};

export default nextConfig;
