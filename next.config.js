/* eslint-disable @typescript-eslint/no-require-imports */
const _serwist = require('@serwist/next');
const withSerwist = (_serwist && (_serwist.default || _serwist));

if (typeof withSerwist !== 'function') {
  throw new Error("withSerwist is not a function — check @serwist/next export");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // d26: lucide-react barrel import -> per-icon import (tree-shaking).
    // Misurato: chunk 168 (icone+Base UI) 37 kB gzip prima.
    optimizePackageImports: ['lucide-react'],
  },
  // Development only: expose the local Supabase gateway on the same origin as
  // the app. A phone on the LAN cannot reach 127.0.0.1 (that is the phone
  // itself), and an http:// call from an https:// dev page is blocked as mixed
  // content. With this rewrite the browser talks only to the dev server.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    const target = process.env.SUPABASE_INTERNAL_URL ?? 'http://127.0.0.1:54321';
    return [{ source: '/supabase/:path*', destination: `${target}/:path*` }];
  },
};

const serwistConfig = {
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: [{ url: '/~offline', revision: '1' }],
};

module.exports = process.env.NODE_ENV === 'development'
  ? nextConfig
  : withSerwist(serwistConfig)(nextConfig);
