const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
