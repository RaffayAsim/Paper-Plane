import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { config } from "../../lib/config.js";
import { prisma } from "../../lib/prisma.js";
import { squareClient } from "../../lib/square.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { SubscriptionStatus } from "../../generated/prisma/index.js";
import {
  ensureSquareCustomer,
  getBillingPlans,
  upsertSubscriptionFromSquare,
  mapSquareStatus,
} from "./billing.service.js";

const router = Router();

// Helper to verify Square Webhook signatures
function verifySquareWebhook(
  signature: string,
  webhookUrl: string,
  rawBody: string,
  signatureKey: string
): boolean {
  try {
    const hmac = crypto.createHmac("sha256", signatureKey);
    hmac.update(webhookUrl + rawBody);
    const hash = hmac.digest("base64");
    return hash === signature;
  } catch (error) {
    return false;
  }
}

router.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    res.json({
      items: getBillingPlans(),
    });
  }),
);

router.get(
  "/square-config",
  asyncHandler(async (_req, res) => {
    res.json({
      appId: config.SQUARE_APP_ID || "sandbox-sq0idb-PLACEHOLDER",
      locationId: config.SQUARE_LOCATION_ID || "PLACEHOLDER_LOCATION",
    });
  }),
);

router.post(
  "/checkout-session",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({
      priceId: z.string().min(1),
      sourceId: z.string().optional(), // Square card nonce from frontend Web Payments SDK
    }).parse(req.body);

    const isMock = body.priceId.startsWith("mock_price_") || !squareClient || !body.sourceId;

    if (isMock) {
      const userId = req.auth!.userId;
      const planName = "ai_lead_gen" as const;

      const existingSub = await prisma.subscription.findFirst({
        where: { userId: userId },
      });

      if (existingSub) {
        await prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            status: "active",
            planName,
            currentPeriodEnd: new Date("2030-01-01"),
            cancelAtPeriodEnd: false,
          },
        });
      } else {
        await prisma.subscription.create({
          data: {
            userId: userId,
            status: "active",
            planName,
            currentPeriodEnd: new Date("2030-01-01"),
            cancelAtPeriodEnd: false,
          },
        });
      }

      return res.json({ url: `${config.APP_URL}/onboarding` });
    }

    if (!squareClient) {
      throw new Error("Square client is not configured");
    }

    const sourceId = body.sourceId;
    if (!sourceId) {
      throw new Error("Payment source token is required");
    }

    const userId = req.auth!.userId;
    const email = req.auth!.email;

    // 1. Ensure customer exists in Square
    const customer = await ensureSquareCustomer(userId, email);

    // 2. Link Card on File using createCard
    const cardResult = await squareClient.cards.create({
      idempotencyKey: crypto.randomUUID(),
      sourceId: sourceId,
      card: {
        customerId: customer.squareCustomerId,
      },
    });

    const cardId = cardResult.card?.id;
    if (!cardId) {
      throw new Error("Failed to link card to customer in Square");
    }

    // 3. Create Subscription
    const subResult = await squareClient.subscriptions.create({
      idempotencyKey: crypto.randomUUID(),
      locationId: config.SQUARE_LOCATION_ID || "",
      customerId: customer.squareCustomerId,
      planVariationId: body.priceId, // Catalog Plan Variation ID
      cardId: cardId,
    });

    const subscription = subResult.subscription;
    if (!subscription?.id) {
      throw new Error("Failed to create subscription in Square");
    }

    // 4. Upsert subscription locally
    await upsertSubscriptionFromSquare({
      userId,
      squareCustomerId: customer.squareCustomerId,
      squareSubscriptionId: subscription.id,
      squarePlanId: body.priceId,
      status: mapSquareStatus(subscription.status || "ACTIVE"),
      currentPeriodEnd: subscription.chargedThroughDate ? new Date(subscription.chargedThroughDate) : null,
      cancelAtPeriodEnd: subscription.canceledDate != null,
    });

    res.json({ url: `${config.APP_URL}/onboarding` });
  }),
);

router.post(
  "/portal-session",
  requireAuth,
  asyncHandler(async (req, res) => {
    // Square doesn't have a direct billing portal URL like Stripe.
    // We redirect them back to the dashboard billing section, where they can trigger a cancel request directly.
    res.json({ url: `${config.APP_URL}/dashboard?manage=billing` });
  }),
);

router.post(
  "/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: "active" },
    });

    if (!subscription || !subscription.squareSubscriptionId) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    if (squareClient) {
      await squareClient.subscriptions.cancel({
        subscriptionId: subscription.squareSubscriptionId,
      });
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "canceled",
        cancelAtPeriodEnd: true,
      },
    });

    res.json({ success: true });
  }),
);

router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const signature = req.headers["x-square-hmacsha256-signature"];
    const webhookUrl = `${config.APP_URL}/api/billing/webhook`; // Construct the webhook endpoint URL

    const rawBody = (req as { rawBody?: Buffer }).rawBody?.toString("utf8") ?? JSON.stringify(req.body);

    if (config.SQUARE_WEBHOOK_SIGNATURE_KEY && signature && typeof signature === "string") {
      const isValid = verifySquareWebhook(signature, webhookUrl, rawBody, config.SQUARE_WEBHOOK_SIGNATURE_KEY);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid Square signature" });
      }
    }

    const payload = req.body;
    const eventType = payload?.type;

    if (
      eventType === "subscription.created" ||
      eventType === "subscription.updated"
    ) {
      const subscription = payload.data?.object?.subscription;
      if (subscription?.id && subscription?.customer_id) {
        const customer = await prisma.squareCustomer.findUnique({
          where: { squareCustomerId: subscription.customer_id },
        });

        if (customer) {
          await upsertSubscriptionFromSquare({
            userId: customer.userId,
            squareCustomerId: subscription.customer_id,
            squareSubscriptionId: subscription.id,
            squarePlanId: subscription.plan_variation_id || null,
            status: mapSquareStatus(subscription.status || "ACTIVE"),
            currentPeriodEnd: subscription.charged_through_date ? new Date(subscription.charged_through_date) : null,
            cancelAtPeriodEnd: subscription.canceled_date != null,
          });
        }
      }
    }

    res.json({ received: true });
  }),
);

router.get(
  "/usage",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const sentCount = await prisma.emailMessage.count({
      where: {
        sentByUserId: userId,
        direction: "outgoing",
      },
    });
    res.json({ sentCount });
  }),
);

router.post(
  "/upgrade-request",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const body = z
      .object({
        planSelected: z.string().min(1),
        specialRequirements: z.string().optional().default(""),
      })
      .parse(req.body);

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: "UPGRADE_REQUEST",
        entityType: "Subscription",
        metadata: {
          planSelected: body.planSelected,
          specialRequirements: body.specialRequirements,
        },
      },
    });

    res.json({ success: true, message: "We have received your upgrade request. We will contact you in 24 hours." });
  }),
);

export const billingRouter = router;

