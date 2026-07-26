export default () => ({
  environment: process.env.NODE_ENV ?? 'development',
  server: {
    port: Number(process.env.PORT ?? 3001),
  },
  frontend: {
    urls: (process.env.FRONTEND_URL ?? 'http://localhost:3000')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean),
  },
  mapbox: {
    accessToken: process.env.MAPBOX_ACCESS_TOKEN ?? '',
  },
});
