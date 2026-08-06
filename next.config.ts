import type { NextConfig } from "next";
import { getServerEnvironment } from "./src/server/env";

getServerEnvironment();

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
