import type { NextConfig } from "next";

/**
 * Next.js development-resource/HMR origins only. This is not the REST or
 * Socket.IO backend origin. Use comma-separated hostnames in the untracked
 * local environment when opening the frontend from another device.
 */
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
