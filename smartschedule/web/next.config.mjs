const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep production builds from overwriting an active development server's
  // JavaScript chunks. `next start` uses the same production directory.
  distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
  env: { NEXT_PUBLIC_API_URL: API_URL },
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${API_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
