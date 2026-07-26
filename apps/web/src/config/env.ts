export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  appEnvironment: process.env.NEXT_PUBLIC_APP_ENV ?? 'development',
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '',
} as const;
