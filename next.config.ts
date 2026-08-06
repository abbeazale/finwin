import type { NextConfig } from "next";
import { getServerEnvironment } from "./src/server/env";
import {
  getSecurityHeaders,
  poweredByHeader,
} from "./src/server/security/headers";

const env = getServerEnvironment();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getSecurityHeaders(env.deployment),
      },
    ];
  },
};

export default nextConfig;
