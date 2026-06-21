import { getUserAiBrandProfile } from "../../lib/ai-brand-profile.js";
import { generateAiComposeEnhancement } from "../../lib/ai-provider.js";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { writeAuditLog } from "../../utils/audit.js";
import { canAccessEmail, sendEmail, syncInbox } from "./email.service.js";

const router = Router();

function getUserEmailScope(userId: string) {
  return {
    OR: [
      { sentByUserId: userId },
      { thread: { is: { organizationId: userId } } },
    ],
  };
}

router.use(requireAuth);
router.use((req, res, next) => {
  if (req.auth?.roles.includes("super_admin")) {
    return next();
  }

  if (!canAccessEmail(req.auth?.subscriptionPlan ?? "base")) {
    return res.status(403).json({ message: "Email access requires Tier Two or higher" });
  }
  next();
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        folder: z.enum(["inbox", "sent"]).default("inbox"),
        search: z.string().optional(),
      })
      .parse(req.query);

    const direction = query.folder === "inbox" ? "incoming" : "outgoing";
    const messages = await prisma.emailMessage.findMany({
      where: {
        ...getUserEmailScope(req.auth!.userId),
        direction,
        ...(query.search
          ? {
              OR: [
                { subject: { contains: query.search } },
                { fromEmail: { contains: query.search } },
                { toEmail: { contains: query.search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const threadMap = new Map<string, (typeof messages)[number][]>();

    for (const message of messages) {
      const threadKey = message.threadId ?? `message:${message.id}`;
      const existing = threadMap.get(threadKey);
      if (existing) {
        existing.push(message);
      } else {
        threadMap.set(threadKey, [message]);
      }
    }

    const items = [...threadMap.entries()].map(([threadKey, threadMessages]) => {
      const latest = threadMessages[0]!;
      return {
        id: latest.id,
        threadId: latest.threadId ?? threadKey,
        subject: latest.subject,
        body: latest.body,
        fromEmail: latest.fromEmail,
        toEmail: latest.toEmail,
        direction: latest.direction,
        isRead: latest.isRead,
        createdAt: latest.createdAt,
        messageCount: threadMessages.length,
        unreadCount: threadMessages.filter((item) => !item.isRead && item.direction === "incoming").length,
      };
    });

    res.json({ items });
  }),
);

router.get(
  "/thread/:threadId",
  asyncHandler(async (req, res) => {
    const { threadId } = z.object({ threadId: z.string() }).parse(req.params);
    const items = await prisma.emailMessage.findMany({
      where: {
        threadId,
        ...getUserEmailScope(req.auth!.userId),
      },
      orderBy: { createdAt: "asc" },
    });

    if (items.length === 0) {
      return res.status(404).json({ message: "Thread not found" });
    }

    res.json({ items });
  }),
);

router.get(
  "/ai-logs",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).default(100),
      })
      .parse(req.query);

    const aiLogActions = [
      "emails.human_review_requested",
      "emails.notify_assigned_user",
      "emails.auto_reply.pause",
      "emails.followup.schedule",
      "admin.task.create",
    ] as const;

    const where = req.auth?.roles.includes("super_admin")
      ? {
          action: { in: [...aiLogActions] },
        }
      : {
          action: { in: [...aiLogActions] },
          OR: [
            { actorUserId: req.auth!.userId },
            {
              metadata: {
                path: ["assignedUserId"],
                equals: req.auth!.userId,
              },
            },
          ],
        };

    const items = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    res.json({
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: item.metadata,
        createdAt: item.createdAt,
        actor: item.actor
          ? {
              id: item.actor.id,
              email: item.actor.email,
              displayName: item.actor.displayName,
            }
          : null,
      })),
    });
  }),
);

router.get(
  "/lead-history",
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().min(1) }).parse(req.query);
    const normalizedEmail = email.trim().toLowerCase();
    const isSuperAdmin = req.auth?.roles.includes("super_admin") ?? false;

    const messages = await prisma.emailMessage.findMany({
      where: {
        ...(isSuperAdmin ? {} : getUserEmailScope(req.auth!.userId)),
        OR: [
          { toEmail: normalizedEmail },
          { fromEmail: normalizedEmail },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ items: messages });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const item = await prisma.emailMessage.findFirst({
      where: {
        id,
        ...getUserEmailScope(req.auth!.userId),
      },
    });
    if (!item) {
      return res.status(404).json({ message: "Email not found" });
    }
    res.json({ item });
  }),
);

router.post(
  "/ai-enhance",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        toEmail: z.string().email().optional().default(""),
        subject: z.string().max(255).optional().default(""),
        body: z.string().min(1),
      })
      .parse(req.body);

    const brandProfile = await getUserAiBrandProfile(req.auth!.userId);
    const result = await generateAiComposeEnhancement({
      brandProfile,
      toEmail: body.toEmail,
      subject: body.subject,
      body: body.body,
    });

    if (!result) {
      return res.status(400).json({ message: "AI provider is unavailable or did not return an email draft." });
    }

    res.json({
      item: {
        subject: result.subject,
        body: result.body,
        provider: result.provider,
        model: result.model,
      },
    });
  }),
);

router.post(
  "/send",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        toEmail: z.string().email(),
        subject: z.string().min(1).max(255),
        body: z.string().min(1),
      })
      .parse(req.body);

    const item = await sendEmail({
      userId: req.auth!.userId,
      subscriptionPlan: req.auth?.subscriptionPlan ?? "base",
      isSuperAdmin: req.auth?.roles.includes("super_admin"),
      ...body,
    });
    res.status(201).json({ item });
  }),
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ isRead: z.boolean().default(true) }).parse(req.body);
    const existing = await prisma.emailMessage.findFirst({
      where: {
        id,
        ...getUserEmailScope(req.auth!.userId),
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "Email not found" });
    }

    const item = await prisma.emailMessage.update({
      where: { id: existing.id },
      data: { isRead: body.isRead },
    });
    res.json({ item });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const existing = await prisma.emailMessage.findFirst({
      where: {
        id,
        ...getUserEmailScope(req.auth!.userId),
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "Email not found" });
    }

    await prisma.emailMessage.delete({ where: { id: existing.id } });
    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "emails.delete",
      entityType: "email_message",
      entityId: existing.id,
    });
    res.status(204).send();
  }),
);

router.post(
  "/sync",
  asyncHandler(async (req, res) => {
    const result = await syncInbox(req.auth?.userId);
    res.json(result);
  }),
);


export const emailRouter = router;
