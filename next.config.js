import withSerwist from '@serwist/next';

const isDev = process.env.NODE_ENV === 'development';

if (typeof withSerwist !== 'function') {
  console.warn("@serwist/next not loaded — PWA disabled");
}

const baseConfig = {
  compiler: {
    removeConsole: isDev
      ? false
      : { exclude: ["error", "warn"] },
  },
};

export default isDev
  ? baseConfig
  : typeof withSerwist === 'function'
    ? withSerwist({
        swSrc: 'app/sw.ts',
        swDest: 'public/sw.js',
      })(baseConfig)
    : baseConfig;