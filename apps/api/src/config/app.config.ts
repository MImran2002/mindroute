export default () => ({
  environment: process.env.NODE_ENV ?? 'development',

  server: {
    port: Number(process.env.PORT ?? 3001),
  },

  frontend: {
    url: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  },

  database: {
    url: process.env.DATABASE_URL,
  },
});
