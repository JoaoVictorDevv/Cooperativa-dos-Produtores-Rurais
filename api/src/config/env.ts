import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default("127.0.0.1"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_JWT_MODE: z.enum(["jwks", "auth-server"]).default("jwks"),
});

export type Environment = z.infer<typeof schema> & { corsOrigins: string[] };

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const parsed = schema.parse(source);
  return {
    ...parsed,
    corsOrigins: parsed.CORS_ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean),
  };
}
