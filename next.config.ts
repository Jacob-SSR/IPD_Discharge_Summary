import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // build แบบ standalone สำหรับ Docker multi-stage (ดู Dockerfile)
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
