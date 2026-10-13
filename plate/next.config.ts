import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old addresses from the first version (and home-screen installs that start at /today).
  async redirects() {
    return [
      { source: "/today", destination: "/coach", permanent: false },
      { source: "/history", destination: "/food/history", permanent: false },
    ];
  },
};

export default nextConfig;
