/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  eslint: {
    // Ignore ESLint during production builds to avoid config issues
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Only check types, don't fail on warnings
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig
