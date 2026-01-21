/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['llmwhiteboard.com', 'localhost:22000'],
    },
  },
};

module.exports = nextConfig;
