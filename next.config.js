// Source - https://stackoverflow.com/a
// Posted by Code on the Rocks
// Retrieved 2025-12-21, License - CC BY-SA 4.0

// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
