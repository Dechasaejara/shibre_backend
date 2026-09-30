import { z } from 'zod';

const envSchema = z.object({
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  AUTH_SECRET: z.string().min(16).default('change-me-in-development'),
  CORS_ORIGIN: z.string().optional(),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://shibre:shibre@localhost:55432/shibre?schema=public'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose'])
    .optional(),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return parsed.data;
}
