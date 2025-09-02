import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow external thumbnail / image hosts used in VideoGrid
    domains: [
      'img.coomer.st',
      'n3.coomer.st',
      // add more hosts here if needed
    ],
  },
};

export default nextConfig;
