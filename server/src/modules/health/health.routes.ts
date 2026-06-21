import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";
import { asyncHandler } from "../../middleware/async-handler.js";

const router = Router();

router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    if (redis) {
      await redis.ping();
    }
    res.json({ ok: true });
  }),
);

export const healthRouter = router;
