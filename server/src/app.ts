import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./lib/config.js";
import { createRateLimiter } from "./lib/rate-limit.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { billingRouter } from "./modules/billing/billing.routes.js";
import { emailRouter } from "./modules/email/email.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { leadsRouter } from "./modules/leads/leads.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.APP_URL, credentials: false }));
  app.use(helmet());
  app.use(
    express.json({
      limit: "10mb",
      verify: (req, _res, buffer) => {
        (req as { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      },
    }),
  );
  app.use(morgan("dev"));
  app.use("/uploads", express.static("uploads"));

  app.use(`${config.API_PREFIX}/auth`, createRateLimiter(15 * 60 * 1000, 100), authRouter);
  app.use(`${config.API_PREFIX}/billing`, billingRouter);
  app.use(`${config.API_PREFIX}/leads`, leadsRouter);
  app.use(`${config.API_PREFIX}/emails`, emailRouter);
  app.use(`${config.API_PREFIX}/admin`, adminRouter);
  app.use(`${config.API_PREFIX}/settings`, settingsRouter);
  app.use(config.API_PREFIX, healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
