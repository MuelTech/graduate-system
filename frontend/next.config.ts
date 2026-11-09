import type { NextConfig } from "next";
import path from "node:path";

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
  // Resolve retired bookmarks before the Admin layout's presentation gate.
  // The destination retains its Full-only UI and backend authorization.
  async redirects() {
    return [{ source: "/admin/users/roles/:path*", destination: "/admin/users/administrators", permanent: false }];
  },
  // Reuse the pure FACULTY-1 catalog across frontend/backend without a second copy.
  turbopack: {
    root: path.resolve(__dirname, ".."),
    // The backend package is CommonJS; this pure TS catalog uses ESM exports.
    rules: {
      "capability-catalog.ts": {
        loaders: [
          path.resolve(__dirname, "scripts/capability-catalog-loader.cjs"),
        ],
        as: "*.js",
      },
    },
  },
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
