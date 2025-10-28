import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
  // Include Prisma engines in the server bundle for Vercel/Next
  webpack: (config) => {
    config.externals = config.externals || [];
    // Ensure Prisma engines are bundled/copied
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@prisma/client/runtime/library": require.resolve("@prisma/client/runtime/library"),
    };
    return config;
  },
};

export default nextConfig;
