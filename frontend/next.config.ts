import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root has its own package.json (Neon config), so pin the app root here.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
