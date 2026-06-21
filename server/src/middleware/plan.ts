import type { NextFunction, Request, Response } from "express";
import type { SubscriptionPlan } from "../lib/access.js";
import { hasPlanAccess } from "../lib/access.js";

export function requirePlan(requiredPlan: SubscriptionPlan) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.roles.includes("super_admin")) {
      return next();
    }

    const currentPlan = req.auth?.subscriptionPlan ?? "base";
    if (!hasPlanAccess(currentPlan, requiredPlan)) {
      return res.status(403).json({ message: `This feature requires the ${requiredPlan} subscription plan` });
    }
    next();
  };
}
