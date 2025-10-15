/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: false
  },
  async rewrites() {
    return [
      {
        source: '/((?!api|_next|spa/assets|spa/.*|static|favicon\\.ico).*)',
        destination: '/spa/index.html'
      }
    ];
  }
};

export default nextConfig;
