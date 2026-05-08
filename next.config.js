const withSerwist = require('@serwist/next').default;

if (typeof withSerwist !== 'function') {
  console.warn("@serwist/next not loaded — PWA disabled");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

module.exports = withSerwist
  ? withSerwist({
      swSrc: 'app/sw.ts',
      swDest: 'public/sw.js',
      disable: process.env.NODE_ENV === 'development',
    })(nextConfig)
  : nextConfig;