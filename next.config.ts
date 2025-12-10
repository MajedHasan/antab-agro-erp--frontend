import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "madconsolution.com",
      },
      {
        protocol: "https",
        hostname: "wembleypark.com",
      },
      {
        protocol: "http",
        hostname: "localhost:5001",
      },
    ],
  },
};

export default nextConfig;
