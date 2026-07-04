import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // allowedDevOrigins bisa di-set via env jika perlu akses dari LAN
  allowedDevOrigins: process.env.DEV_ORIGIN
    ? [process.env.DEV_ORIGIN]
    : undefined,
};

export default nextConfig;
