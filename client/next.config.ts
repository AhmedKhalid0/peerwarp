import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  // Enable image unoptimized for seamless export compatibility
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
