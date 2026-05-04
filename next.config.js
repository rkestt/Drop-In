const _serwist = require('@serwist/next');
const withSerwist = (_serwist && (_serwist.default || _serwist));

if (typeof withSerwist !== 'function') {
  throw new Error("withSerwist is not a function — check @serwist/next export");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

const serwistConfig = {
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
};

module.exports = process.env.NODE_ENV === 'development'
  ? nextConfig
  : withSerwist(serwistConfig)(nextConfig);

module.exports = serwistConfig;
