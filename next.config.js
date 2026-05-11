import withSerwist from '@serwist/next';

const isDev = process.env.NODE_ENV === 'development';

if (typeof withSerwist !== 'function') {
  console.warn("@serwist/next not loaded — PWA disabled");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

export default isDev || !withSerwist
  ? nextConfig
  : withSerwist({
      swSrc: 'app/sw.ts',
      swDest: 'public/sw.js',
    })(nextConfig);