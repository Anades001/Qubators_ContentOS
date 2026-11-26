import { z } from "zod";

/**
 * Single source of truth for server-side configuration.
 * Every external service sits behind a driver switch so the core loop runs at $0 locally.
 */
const bool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z.string().url(),

    // Public URLs
    APP_URL: z.string().url().default("http://localhost:3000"),
    // Public base URL that serves /api/* (Next.js rewrites in dev, Caddy in prod) — same origin as the app.
    API_URL: z.string().url().default("http://localhost:3000"),
    API_PORT: z.coerce.number().int().positive().default(4000),

    // Auth (BetterAuth)
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // Storage
    STORAGE_DRIVER: z.enum(["local", "minio", "r2"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().default("./storage-data"),
    S3_BUCKET: z.string().default("contentos-assets"),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default("auto"),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    R2_ACCOUNT_ID: z.string().optional(),

    // AI
    // "mock" returns deterministic drafts — for tests, CI and machines without Ollama.
    AI_DRIVER: z.enum(["ollama", "mock"]).default("ollama"),
    OLLAMA_HOST: z.string().url().default("http://localhost:11434"),
    AI_MODEL: z.string().default("mistral:7b-instruct"),
    AI_EMBED_MODEL: z.string().default("nomic-embed-text"),

    // Email / billing drivers (stubs in MVP)
    EMAIL_DRIVER: z.enum(["log", "smtp", "zeptomail"]).default("log"),
    SMTP_URL: z.string().optional(),
    ZEPTOMAIL_TOKEN: z.string().optional(),
    PAYSTACK_SECRET_KEY: z.string().optional(),

    // Feature flags (see flags.ts)
    FEATURE_PUBLISHER: bool.default(false),
    FEATURE_ANALYTICS: bool.default(false),
    FEATURE_IMAGE_GEN: bool.default(false),
    FEATURE_BILLING: bool.default(false),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER !== "local") {
      for (const key of ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `required when STORAGE_DRIVER=${env.STORAGE_DRIVER}`,
          });
        }
      }
      if (env.STORAGE_DRIVER === "minio" && !env.S3_ENDPOINT) {
        ctx.addIssue({
          code: "custom",
          path: ["S3_ENDPOINT"],
          message: "required when STORAGE_DRIVER=minio",
        });
      }
      if (env.STORAGE_DRIVER === "r2" && !env.S3_ENDPOINT && !env.R2_ACCOUNT_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["R2_ACCOUNT_ID"],
          message: "R2_ACCOUNT_ID or S3_ENDPOINT required when STORAGE_DRIVER=r2",
        });
      }
    }
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_SECRET"],
        message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join("\n  - ")}`);
    this.name = "EnvError";
  }
}

export function parseServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  // Treat empty strings as unset so `.env` placeholders like `GOOGLE_CLIENT_ID=` don't fail validation.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  const result = serverEnvSchema.safeParse(cleaned);
  if (!result.success) {
    throw new EnvError(result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
  }
  return result.data;
}
