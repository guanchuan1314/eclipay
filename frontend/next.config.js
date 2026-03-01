/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://app:3000/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://app:3000/uploads/:path*',
      },
    ];
  },
}

module.exports = nextConfig
