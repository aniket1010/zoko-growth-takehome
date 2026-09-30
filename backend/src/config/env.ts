import { z } from "zod";

// Fail fast at boot if config is wrong, instead of failing on the first request.
const csv = z
  .string()
  .default("")
  .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean));

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  ZOKO_API_KEY: z.string().default(""),
  ZOKO_API_BASE: z.string().url().default("https://chat.zoko.io/v2"),
  ZOKO_WEBHOOK_TOKEN: z.string().default(""),
  // Digits only, e.g. 919876543210. Anything not in here can never be messaged.
  SEND_ALLOWLIST: csv.transform((xs) => xs.map((x) => x.replace(/\D/g, ""))),
  CORS_ORIGINS: csv,
  POSTHOG_API_KEY: z.string().default(""),
  POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
});

export const env = EnvSchema.parse(process.env);
export type Env = typeof env;
