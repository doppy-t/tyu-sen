/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'node-cron', 'postgres'],
    instrumentationHook: true,
  },
};

export default nextConfig;
