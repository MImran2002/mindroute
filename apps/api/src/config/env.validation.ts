import * as Joi from 'joi';

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3001),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  MAPBOX_ACCESS_TOKEN: Joi.string().min(20).required(),
});
