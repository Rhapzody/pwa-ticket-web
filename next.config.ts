import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/login", destination: "/" },
        { source: "/my-tickets", destination: "/" },
        { source: "/tickets/:ticketId", destination: "/" },
        { source: "/orders", destination: "/" },
        { source: "/account", destination: "/" },
        { source: "/debug/offline", destination: "/" },
        { source: "/offline", destination: "/" },
      ],
    };
  },
};

export default nextConfig;
