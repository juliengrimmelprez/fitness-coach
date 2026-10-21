import type { NextConfig } from "next";

// Basic browser security headers (defense in depth, flagged by /security-review).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // no embedding in other sites (clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Old addresses from the first version (and home-screen installs that start at /today).
  async redirects() {
    return [
      { source: "/today", destination: "/coach", permanent: false },
      { source: "/history", destination: "/food/history", permanent: false },
    ];
  },
};

export default nextConfig;
