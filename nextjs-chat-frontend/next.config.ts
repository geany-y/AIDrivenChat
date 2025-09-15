import type { NextConfig } from "next";
import withPWA from "next-pwa";

const withPwa = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development", // 開発環境ではPWAを無効にする
}) as (config: NextConfig) => NextConfig;

const nextConfig: NextConfig = {
  output: 'standalone',
  /* config options here */
};

export default withPwa(nextConfig);
