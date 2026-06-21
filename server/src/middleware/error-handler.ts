import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      issues: err.flatten(),
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  if (err instanceof Error) {
    logger.error(err.message, err.stack);
    return res.status(500).json({ message: err.message });
  }

  logger.error("Unknown server error", err);
  return res.status(500).json({ message: "Unknown server error" });
}
