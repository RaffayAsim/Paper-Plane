import Redis, { type Redis as RedisClient } from "ioredis";
import { config } from "./config.js";

declare global {
  // eslint-disable-next-line no-var
  var __redis: RedisClient | undefined;
}

export const redis =
  config.REDIS_URL
    ? globalThis.__redis ?? new Redis(config.REDIS_URL, { maxRetriesPerRequest: null })
    : null;

if (redis && process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}
