/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  webpack: (config, { dev }) => {
    // Avoid intermittent ENOENT warnings from filesystem cache races during HMR.
    if (dev) {
      config.cache = { type: 'memory' };
    }
    return config;
  },
};

module.exports = nextConfig;
