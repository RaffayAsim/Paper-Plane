import type { RoleName } from "../generated/prisma/index.js";
import type { SubscriptionPlan } from "../lib/access.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        roles: RoleName[];
        subscriptionPlan: SubscriptionPlan;
        impersonatedBy?: {
          userId: string;
          email: string;
          displayName: string;
        } | null;
      };
      currentUser?: {
        id: string;
        email: string;
        displayName: string;
        isActive: boolean;
        roles: RoleName[];
        subscriptionPlan: SubscriptionPlan;
        impersonatedBy?: {
          userId: string;
          email: string;
          displayName: string;
        } | null;
      };
    }
  }
}

export {};
