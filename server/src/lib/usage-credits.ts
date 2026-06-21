import type { SubscriptionPlan } from "./access.js";
import { prisma } from "./prisma.js";

export type LeadCreditPlan = Exclude<SubscriptionPlan, "base">;

export type LeadCreditPlanLimits = Record<LeadCreditPlan, number>;

export type LeadCreditOverride = {
  userId: string;
  limit: number;
};

const DEFAULT_LEAD_CREDIT_LIMITS: LeadCreditPlanLimits = {
  ai_lead_gen: 30_000,
};

const PLAN_LIMITS_KEY = "credits.leads.plan_limits";
const USER_OVERRIDES_KEY = "credits.leads.user_overrides";

export async function getLeadCreditPlanLimits() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: PLAN_LIMITS_KEY },
  });

  return {
    ...DEFAULT_LEAD_CREDIT_LIMITS,
    ...((setting?.value as Partial<LeadCreditPlanLimits> | null) ?? {}),
  } satisfies LeadCreditPlanLimits;
}

export async function saveLeadCreditPlanLimits(limits: LeadCreditPlanLimits) {
  await prisma.appSetting.upsert({
    where: { key: PLAN_LIMITS_KEY },
    update: { value: limits as never },
    create: { key: PLAN_LIMITS_KEY, value: limits as never },
  });
}

export async function getLeadCreditOverrides() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: USER_OVERRIDES_KEY },
  });

  return ((setting?.value as LeadCreditOverride[] | null) ?? []).map((item) => ({
    userId: item.userId,
    limit: Number(item.limit),
  }));
}

export async function saveLeadCreditOverrides(overrides: LeadCreditOverride[]) {
  await prisma.appSetting.upsert({
    where: { key: USER_OVERRIDES_KEY },
    update: { value: overrides as never },
    create: { key: USER_OVERRIDES_KEY, value: overrides as never },
  });
}

export async function getLeadCreditsUsed(userId: string) {
  const result = await prisma.leadCampaign.aggregate({
    where: {
      createdById: userId,
      status: {
        in: ["pending", "processing", "completed"],
      },
    },
    _sum: {
      leadCount: true,
    },
  });

  return result._sum.leadCount ?? 0;
}

export async function getLeadCreditSummary(input: {
  userId: string;
  subscriptionPlan: SubscriptionPlan;
  isSuperAdmin: boolean;
}) {
  const used = await getLeadCreditsUsed(input.userId);

  if (input.isSuperAdmin) {
    return {
      limit: null,
      used,
      remaining: null,
      planLimit: null,
      overrideLimit: null,
      subscriptionPlan: input.subscriptionPlan,
      unlimited: true,
    };
  }

  if (input.subscriptionPlan === "base") {
    return {
      limit: 0,
      used,
      remaining: 0,
      planLimit: 0,
      overrideLimit: null,
      subscriptionPlan: input.subscriptionPlan,
      unlimited: false,
    };
  }

  const [planLimits, overrides] = await Promise.all([
    getLeadCreditPlanLimits(),
    getLeadCreditOverrides(),
  ]);

  const override = overrides.find((item) => item.userId === input.userId);
  const planLimit = planLimits[input.subscriptionPlan];
  const limit = override?.limit ?? planLimit;

  return {
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    planLimit,
    overrideLimit: override?.limit ?? null,
    subscriptionPlan: input.subscriptionPlan,
    unlimited: false,
  };
}
