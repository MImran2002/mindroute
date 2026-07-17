function requirePublicEnvironmentVariable(
  name: 'NEXT_PUBLIC_API_URL' | 'NEXT_PUBLIC_APP_ENV',
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  apiUrl: requirePublicEnvironmentVariable('NEXT_PUBLIC_API_URL'),

  appEnvironment: requirePublicEnvironmentVariable(
    'NEXT_PUBLIC_APP_ENV',
  ),

  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '',
} as const;
