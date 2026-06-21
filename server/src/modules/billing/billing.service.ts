import { SubscriptionPlan, SubscriptionStatus } from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";
import { squareClient } from "../../lib/square.js";
import { config } from "../../lib/config.js";

export function getBillingPlans() {
  return [
    {
      planName: SubscriptionPlan.ai_lead_gen,
      displayName: "AI Lead Gen",
      price: 499,
      interval: "month",
      priceId: config.SQUARE_PLAN_VARIATION_ID || "mock_price_ai_lead_gen",
      features: [
        "30,000 Lead Credits/month",
        "30,000 AI Emailings/month",
        "3,000 AI Calls/month",
        "AI-driven follow-up automation",
        "Unified B2B pipeline management"
      ],
    },
  ];
}

export async function ensureSquareCustomer(userId: string, email: string) {
  const existing = await prisma.squareCustomer.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  if (!squareClient) {
    throw new Error("Square client is not configured");
  }

  const response = await squareClient.customers.create({
    emailAddress: email,
    referenceId: userId,
  });

  const customer = response.customer;
  if (!customer?.id) {
    throw new Error("Failed to create customer in Square");
  }

  return prisma.squareCustomer.create({
    data: {
      userId,
      squareCustomerId: customer.id,
    },
  });
}

export async function upsertSubscriptionFromSquare(input: {
  userId: string;
  squareCustomerId: string;
  squareSubscriptionId: string;
  squarePlanId?: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const planName = SubscriptionPlan.ai_lead_gen;

  const subscription = await prisma.subscription.upsert({
    where: {
      squareSubscriptionId: input.squareSubscriptionId,
    },
    update: {
      squareCustomerId: input.squareCustomerId,
      squarePlanId: input.squarePlanId ?? null,
      status: input.status,
      planName,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    },
    create: {
      userId: input.userId,
      squareCustomerId: input.squareCustomerId,
      squareSubscriptionId: input.squareSubscriptionId,
      squarePlanId: input.squarePlanId ?? null,
      status: input.status,
      planName,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    },
  });

  return subscription;
}

export function mapSquareStatus(squareStatus: string): SubscriptionStatus {
  const normalized = squareStatus.toUpperCase();
  if (normalized === "ACTIVE") return "active";
  if (normalized === "PENDING") return "trialing";
  return "canceled";
}
