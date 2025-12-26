import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  allowedDevOrigins: ['reson.buzz'],
  distDir: isDev ? '.next-dev' : '.next',
};

export default nextConfig;
