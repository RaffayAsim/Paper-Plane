export type SubscriptionPlan = "base" | "ai_lead_gen";
export type AdminRole = "super_admin";

export function getPlanRank(plan: SubscriptionPlan) {
  if (plan === "base") return 0;
  return 1;
}

export function hasPlanAccess(currentPlan: SubscriptionPlan, requiredPlan: SubscriptionPlan) {
  if (currentPlan === "ai_lead_gen") return true;
  if (currentPlan === "base") return true;
  return getPlanRank(currentPlan) >= getPlanRank(requiredPlan);
}

