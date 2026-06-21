import { RoleName, SubscriptionStatus } from "../../generated/prisma/index.js";
import { Router } from "express";
import { z } from "zod";
import { getAiProviderConfig, saveAiProviderConfig } from "../../lib/ai-settings.js";
import { applyDefaultRule, getSmtpConfigs, normalizeSmtpConfig, saveSmtpConfigs } from "../../lib/email-settings.js";
import { prisma } from "../../lib/prisma.js";
import { squareClient } from "../../lib/square.js";
import {
  getLeadCreditOverrides,
  getLeadCreditPlanLimits,
  getLeadCreditSummary,
  saveLeadCreditOverrides,
  saveLeadCreditPlanLimits,
} from "../../lib/usage-credits.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { issueTokens } from "../auth/auth.service.js";
import { writeAuditLog } from "../../utils/audit.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole([RoleName.super_admin]));

const leadCreditLimitsSchema = z.object({
  ai_lead_gen: z.coerce.number().int().min(0),
});

const adminUserParamsSchema = z.object({
  id: z.string().min(1),
});

const adminSubscriptionPlanSchema = z.object({
  subscriptionPlan: z.enum(["base", "ai_lead_gen"]),
});

router.get(
  "/credits",
  asyncHandler(async (_req, res) => {
    const [limits, overrides, users] = await Promise.all([
      getLeadCreditPlanLimits(),
      getLeadCreditOverrides(),
      prisma.user.findMany({
        include: {
          roles: { include: { role: true } },
          subscriptions: {
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const items = await Promise.all(
      users.map(async (user) => {
        const activeSubscription = user.subscriptions.find(
          (entry) => entry.status === "active" || entry.status === "trialing",
        );
        const subscriptionPlan = activeSubscription?.planName ?? "base";
        const summary = await getLeadCreditSummary({
          userId: user.id,
          subscriptionPlan,
          isSuperAdmin: user.roles.some((entry) => entry.role.name === RoleName.super_admin),
        });

        return {
          userId: user.id,
          email: user.email,
          displayName: user.displayName,
          subscriptionPlan,
          isSuperAdmin: user.roles.some((entry) => entry.role.name === RoleName.super_admin),
          used: summary.used,
          limit: summary.limit,
          remaining: summary.remaining,
          overrideLimit: summary.overrideLimit,
        };
      }),
    );

    res.json({
      leadCredits: {
        planLimits: limits,
        users: items,
        overrides,
      },
    });
  }),
);

router.put(
  "/credits/lead-limits",
  asyncHandler(async (req, res) => {
    const body = leadCreditLimitsSchema.parse(req.body);
    await saveLeadCreditPlanLimits(body);
    res.json({ item: body });
  }),
);

router.put(
  "/credits/users/:id",
  asyncHandler(async (req, res) => {
    const params = adminUserParamsSchema.parse(req.params);
    const body = z.object({ limit: z.coerce.number().int().min(0).nullable() }).parse(req.body);
    const overrides = await getLeadCreditOverrides();
    const next = body.limit === null
      ? overrides.filter((item) => item.userId !== params.id)
      : [
          ...overrides.filter((item) => item.userId !== params.id),
          { userId: params.id, limit: body.limit },
        ];

    await saveLeadCreditOverrides(next);
    res.status(204).send();
  }),
);

const smtpConfigSchema = z.object({
  name: z.string().min(1).max(120),
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().positive().max(65535),
  secure: z.boolean(),
  user: z.string().min(1).max(255),
  pass: z.string().min(1).max(255),
  fromEmail: z.string().email(),
  imapHost: z.string().max(255).optional().or(z.literal("")),
  imapPort: z.coerce.number().int().positive().max(65535).optional(),
  imapSecure: z.boolean().optional(),
  imapUser: z.string().max(255).optional().or(z.literal("")),
  imapPass: z.string().max(255).optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  dailySendLimit: z.coerce.number().int().positive().optional().default(50),
});

const aiProviderSchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini", "openai_compatible"]),
  apiKey: z.string().min(1).max(500),
  model: z.string().min(1).max(200),
  baseUrl: z.string().url().optional().or(z.literal("")),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  isActive: z.boolean().default(true),
});

router.get(
  "/ai-settings",
  asyncHandler(async (_req, res) => {
    res.json({ item: await getAiProviderConfig() });
  }),
);

router.put(
  "/ai-settings",
  asyncHandler(async (req, res) => {
    const body = aiProviderSchema.parse(req.body);
    const item = await saveAiProviderConfig({
      provider: body.provider,
      apiKey: body.apiKey,
      model: body.model,
      baseUrl: body.baseUrl || undefined,
      temperature: body.temperature,
      isActive: body.isActive,
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "admin.ai_settings.update",
      entityType: "app_settings",
      metadata: {
        provider: item.provider,
        model: item.model,
        isActive: item.isActive,
      },
    });

    res.json({ item });
  }),
);

router.get(
  "/email-settings",
  asyncHandler(async (_req, res) => {
    const items = (await getSmtpConfigs()).filter((item) => !item.ownerUserId);
    res.json({ items });
  }),
);

router.post(
  "/email-settings",
  asyncHandler(async (req, res) => {
    const body = smtpConfigSchema.parse(req.body);
    const configs = await getSmtpConfigs();
    const shared = configs.filter((item) => !item.ownerUserId);
    const others = configs.filter((item) => item.ownerUserId);
    const nextShared = applyDefaultRule([...shared, normalizeSmtpConfig(body)]);
    await saveSmtpConfigs([...others, ...nextShared]);
    res.status(201).json({ items: nextShared });
  }),
);

router.patch(
  "/email-settings/:id",
  asyncHandler(async (req, res) => {
    const body = smtpConfigSchema.parse(req.body);
    const configs = await getSmtpConfigs();
    const shared = configs.filter((item) => !item.ownerUserId);
    const others = configs.filter((item) => item.ownerUserId);
    const existing = shared.find((item) => item.id === req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "SMTP config not found" });
    }

    const nextShared = applyDefaultRule(
      shared.map((item) =>
        item.id === req.params.id
          ? normalizeSmtpConfig(body, item.id, item.createdAt, item)
          : item,
      ),
    );

    await saveSmtpConfigs([...others, ...nextShared]);
    res.json({ items: nextShared });
  }),
);

router.delete(
  "/email-settings/:id",
  asyncHandler(async (req, res) => {
    const configs = await getSmtpConfigs();
    const shared = configs.filter((item) => !item.ownerUserId);
    const others = configs.filter((item) => item.ownerUserId);
    const nextShared = applyDefaultRule(shared.filter((item) => item.id !== req.params.id));
    await saveSmtpConfigs([...others, ...nextShared]);
    res.status(204).send();
  }),
);

router.get(
  "/subscriptions",
  asyncHandler(async (_req, res) => {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            isActive: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const uniquePlanIds = [...new Set(subscriptions.map((item) => item.squarePlanId).filter(Boolean))] as string[];
    const planAmounts = new Map<string, number>();

    for (const planId of uniquePlanIds) {
      planAmounts.set(planId, 49900); // $499.00 in cents
    }

    const activeStatuses = new Set(["active", "trialing"]);
    const activeSubscriptions = subscriptions.filter((item) => activeStatuses.has(item.status));
    const monthlyRevenue = activeSubscriptions.reduce((total, item) => {
      return total + (item.squarePlanId ? planAmounts.get(item.squarePlanId) ?? 0 : 0);
    }, 0);

    const byPlan = {
      base: 0,
      ai_lead_gen: subscriptions.filter((item) => item.planName === "ai_lead_gen" && activeStatuses.has(item.status)).length,
    };

    res.json({
      summary: {
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: activeSubscriptions.length,
        monthlyRevenue,
        currency: "usd",
        byPlan,
      },
      items: subscriptions.map((item) => ({
        id: item.id,
        userId: item.userId,
        user: item.user,
        status: item.status,
        planName: item.planName,
        squarePlanId: item.squarePlanId,
        squareSubscriptionId: item.squareSubscriptionId,
        amount: item.squarePlanId ? planAmounts.get(item.squarePlanId) ?? 0 : 0,
        cancelAtPeriodEnd: item.cancelAtPeriodEnd,
        currentPeriodEnd: item.currentPeriodEnd,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  }),
);

router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const [users, profileSettings] = await Promise.all([
      prisma.user.findMany({
        include: {
          roles: { include: { role: true } },
          subscriptions: {
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.appSetting.findMany({
        where: { key: { startsWith: "user.ai_brand_profile." } },
      }),
    ]);

    const profileMap = new Map<string, Record<string, unknown>>();
    for (const setting of profileSettings) {
      const userId = setting.key.split(".").pop();
      if (userId) {
        profileMap.set(userId, setting.value as Record<string, unknown>);
      }
    }

    res.json({
      items: users.map((user) => {
        const profile = profileMap.get(user.id);
        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          isActive: user.isActive,
          createdAt: user.createdAt,
          roles: user.roles.map((entry) => entry.role.name),
          subscriptionPlan: user.subscriptions[0]?.planName ?? "base",
          subscription: user.subscriptions[0] ?? null,
          hasProfile: Boolean(profile?.brandName),
          setupStatus: profile?.setupStatus || (profile?.brandName ? "approved" : "none"),
          onboardedAt: profile?.onboardedAt || null,
        };
      }),
    });
  }),
);

router.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const params = adminUserParamsSchema.parse(req.params);
    const body = z
      .object({
        displayName: z.string().min(2).max(120),
        email: z.string().email(),
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        displayName: body.displayName,
        email: body.email.toLowerCase(),
      },
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "admin.user.update",
      entityType: "user",
      entityId: updated.id,
      metadata: body,
    });

    res.json({
      item: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        isActive: updated.isActive,
      },
    });
  }),
);

router.patch(
  "/users/:id/subscription",
  asyncHandler(async (req, res) => {
    const params = adminUserParamsSchema.parse(req.params);
    const body = adminSubscriptionPlanSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        roles: { include: { role: true } },
        subscriptions: {
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          userId: user.id,
          status: {
            in: [
              SubscriptionStatus.incomplete,
              SubscriptionStatus.trialing,
              SubscriptionStatus.active,
              SubscriptionStatus.past_due,
              SubscriptionStatus.unpaid,
            ],
          },
        },
        data: {
          status: SubscriptionStatus.canceled,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date(),
        },
      });

      if (body.subscriptionPlan !== "base") {
        await tx.subscription.create({
          data: {
            userId: user.id,
            status: SubscriptionStatus.active,
            planName: body.subscriptionPlan,
            cancelAtPeriodEnd: false,
          },
        });
      }
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "admin.user_subscription.update",
      entityType: "user",
      entityId: user.id,
      metadata: body,
    });

    res.status(204).send();
  }),
);

router.patch(
  "/users/:id/role",
  asyncHandler(async (req, res) => {
    const params = adminUserParamsSchema.parse(req.params);
    const body = z.object({ role: z.union([z.nativeEnum(RoleName), z.literal("none")]) }).parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: { roles: true },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.userRole.deleteMany({ where: { userId: user.id } });

    if (body.role !== "none") {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: body.role } });
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });
    }

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "admin.user_role.update",
      entityType: "user",
      entityId: user.id,
      metadata: body,
    });

    res.status(204).send();
  }),
);

router.post(
  "/users/:id/impersonate",
  asyncHandler(async (req, res) => {
    const params = adminUserParamsSchema.parse(req.params);

    if (params.id === req.auth?.userId) {
      return res.status(400).json({ message: "You are already signed in as this user" });
    }

    const admin = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
    });

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        roles: { include: { role: true } },
        subscriptions: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!admin) {
      return res.status(401).json({ message: "Admin account not found" });
    }

    if (!user || !user.isActive) {
      return res.status(404).json({ message: "User not found or inactive" });
    }

    const session = await issueTokens(user, {
      userId: admin.id,
      email: admin.email,
      displayName: admin.displayName,
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "admin.user.impersonate",
      entityType: "user",
      entityId: user.id,
      metadata: {
        impersonatedUserEmail: user.email,
      },
    });

    res.json(session);
  }),
);

router.patch(
  "/users/:id/status",
  asyncHandler(async (req, res) => {
    const params = adminUserParamsSchema.parse(req.params);
    const body = z.object({ isActive: z.boolean() }).parse(req.body);
    await prisma.user.update({
      where: { id: params.id },
      data: { isActive: body.isActive },
    });
    res.status(204).send();
  }),
);

router.patch(
  "/users/:id/approve-profile",
  asyncHandler(async (req, res) => {
    const params = adminUserParamsSchema.parse(req.params);
    const key = `user.ai_brand_profile.${params.id}`;
    const setting = await prisma.appSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      return res.status(404).json({ message: "User company profile not found" });
    }

    const value = setting.value as Record<string, unknown>;
    const updatedValue = {
      ...value,
      onboardedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      setupStatus: "approved",
      updatedAt: new Date().toISOString(),
    };

    await prisma.appSetting.update({
      where: { key },
      data: { value: updatedValue },
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "admin.user_profile.approve",
      entityType: "user",
      entityId: params.id,
    });

    res.status(204).send();
  }),
);

router.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const params = adminUserParamsSchema.parse(req.params);
    if (params.id === req.auth?.userId) {
      return res.status(400).json({ message: "You cannot delete your own user" });
    }
    await prisma.user.delete({ where: { id: params.id } });
    res.status(204).send();
  }),
);



export const adminRouter = router;

