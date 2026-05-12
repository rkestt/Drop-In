import withSerwist from '@serwist/next';

const isDev = process.env.NODE_ENV === 'development';

if (typeof withSerwist !== 'function') {
  console.warn("@serwist/next not loaded — PWA disabled");
}

const baseConfig = {
  output: 'standalone',
  compiler: {
    removeConsole: isDev ? false : true,
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