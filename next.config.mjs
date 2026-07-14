/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'node-cron'],
    instrumentationHook: true,
  },
};

export default nextConfig;
