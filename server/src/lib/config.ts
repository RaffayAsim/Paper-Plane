import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default("http://localhost:8080"),
  API_PREFIX: z.string().default("/api"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8),
  SQUARE_ACCESS_TOKEN: z.string().optional(),
  SQUARE_APP_ID: z.string().optional(),
  SQUARE_LOCATION_ID: z.string().optional(),
  SQUARE_PLAN_VARIATION_ID: z.string().optional(),
  SQUARE_WEBHOOK_SIGNATURE_KEY: z.string().optional(),
  VAPI_API_KEY: z.string().optional(),
  VAPI_BASE_URL: z.string().url().default("https://api.vapi.ai"),
  VAPI_WEBHOOK_TOKEN: z.string().optional(),
  BROWSERLESS_TOKEN: z.string().optional(),
  BROWSERLESS_BASE_URL: z.string().url().default("https://production-sfo.browserless.io"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_SECURE: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .default("true"),
  IMAP_USER: z.string().optional(),
  IMAP_PASS: z.string().optional(),
  EMAIL_BACKGROUND_SYNC_ENABLED: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .default("false"),
  VOICE_BACKGROUND_SYNC_ENABLED: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .default("true"),
  GOOGLE_MAPS_USE_PROXY: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .optional(),
  GOOGLE_MAPS_HEADLESS: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .default("true"),
  YELLOW_PAGES_USE_PROXY: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .optional(),
  YELLOW_PAGES_PROXY_OVERRIDE: z.string().optional(),
  YELLOW_PAGES_HEADLESS: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .default("true"),
  YELP_USE_PROXY: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .optional(),
  YELP_PROXY_OVERRIDE: z.string().optional(),
  YELP_BROWSERLESS_TIMEOUT_MS: z.coerce.number().default(90000),
  YELP_BROWSERLESS_WAIT_MS: z.coerce.number().default(8000),
  YELP_BROWSERLESS_PROXY: z.enum(["residential"]).optional(),
  YELP_BROWSERLESS_EXTERNAL_PROXY: z.string().optional(),
  YELP_FORCE_BROWSERLESS: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .default("false"),
  YELP_NAVIGATION_TIMEOUT_MS: z.coerce.number().default(60000),
  YELP_DETAIL_TIMEOUT_MS: z.coerce.number().default(45000),
  YELP_USE_CACHE: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .default("true"),
  YELP_HEADLESS: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .default("true"),
});

export const config = envSchema.parse(process.env);
