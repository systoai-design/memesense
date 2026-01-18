/** @type {import('next').NextConfig} */
const nextConfig = {
  // Handle native modules like better-sqlite3
  serverExternalPackages: ['better-sqlite3'],

  // Use empty turbopack config to silence Turbopack warning
  turbopack: {},
};

export default nextConfig;
