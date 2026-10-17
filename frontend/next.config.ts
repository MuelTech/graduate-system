import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js dev resources/HMR when the app is opened from another device
  // on the LAN (e.g. a phone at http://192.168.1.101:3000).
  allowedDevOrigins: ["192.168.1.101"],
};

export default nextConfig;
