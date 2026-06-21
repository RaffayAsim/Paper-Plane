import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../utils/tokens.js";
import type { SubscriptionPlan } from "../lib/access.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  try {
    const token = authHeader.slice("Bearer ".length);
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        roles: {
          include: { role: true },
        },
        subscriptions: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    const roles = user.roles.map((entry) => entry.role.name);
    const activeSubscription = user.subscriptions.find(
      (entry) => entry.status === "active" || entry.status === "trialing",
    );
    const subscriptionPlan = (activeSubscription?.planName as SubscriptionPlan | undefined)
      ?? (payload.subscriptionPlan as SubscriptionPlan | undefined)
      ?? "base";
    const impersonatedBy = payload.impersonatedByUserId
      ? {
          userId: payload.impersonatedByUserId,
          email: payload.impersonatedByEmail ?? "",
          displayName: payload.impersonatedByDisplayName ?? "Admin",
        }
      : null;
    req.auth = {
      userId: user.id,
      email: user.email,
      roles,
      subscriptionPlan,
      impersonatedBy,
    };
    req.currentUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
      roles,
      subscriptionPlan,
      impersonatedBy,
    };

    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
