import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { RedisReply } from "rate-limit-redis";
import { redis } from "./redis.js";

export function createRateLimiter(windowMs: number, max: number) {
  const redisClient = redis;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient
      ? new RedisStore({
          sendCommand: (...args: string[]): Promise<RedisReply> => redisClient.call(...args) as Promise<RedisReply>,
        })
      : undefined,
  });
}
