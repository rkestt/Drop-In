import withSerwist from '@serwist/next';

const isDev = process.env.NODE_ENV === 'development';

if (typeof withSerwist !== 'function') {
  console.warn("@serwist/next not loaded — PWA disabled");
}

const withCacheDisabled = (nextConfig) => ({
  ...nextConfig,
  experimental: {
    ...nextConfig.experimental,
    turbo: {
      ...nextConfig.experimental?.turbo,
      rules: {
        '*': { cache: false },
      },
    },
  },
  compiler: {
    ...nextConfig.compiler,
    removeConsole: isDev ? false : true,
  },
});

const baseConfig = {
  output: 'standalone',
};

export default isDev || !withSerwist
  ? withCacheDisabled(baseConfig)
  : withSerwist({
      swSrc: 'app/sw.ts',
      swDest: 'public/sw.js',
    })(withCacheDisabled(baseConfig));