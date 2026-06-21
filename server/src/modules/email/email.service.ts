import cron, { type ScheduledTask } from "node-cron";
import crypto from "node:crypto";
import { ImapFlow } from "imapflow";
import { Prisma } from "../../generated/prisma/index.js";
import { EmailDirection } from "../../generated/prisma/index.js";
import type { SubscriptionPlan } from "../../lib/access.js";
import { config as appConfig } from "../../lib/config.js";
import {
  applyDefaultRule,
  getSmtpConfigs,
  isImapConfigured,
  saveSmtpConfigs,
  type SmtpConfig,
} from "../../lib/email-settings.js";
import { logger } from "../../lib/logger.js";
import { createTransportForConfig } from "../../lib/mailer.js";
import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../../utils/audit.js";
import { prepareAiAutoReply } from "./auto-reply.service.js";
import { resumeAndProcessCampaigns } from "../leads/message-automation.service.js";

const USER_EMAIL_DAILY_LIMIT = 1000;
let activeSync: Promise<{ imported: number }> | null = null;
let backgroundSyncTask: ScheduledTask | null = null;

export type HumanReviewEmailInput = {
  actorUserId?: string | null;
  subject: string;
  summary: string;
  details?: string | null;
  reason?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type LookupLeadContextInput = {
  userId: string;
  senderEmail?: string | null;
  threadId?: string | null;
};

export type NotifyAssignedUserInput = {
  actorUserId?: string | null;
  threadId?: string | null;
  userId?: string | null;
  subject: string;
  summary: string;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CreateAdminTaskInput = {
  actorUserId?: string | null;
  title: string;
  summary: string;
  priority?: "low" | "normal" | "high" | "urgent";
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PauseAutoReplyForThreadInput = {
  actorUserId?: string | null;
  threadId: string;
  reason: string;
  pausedUntil?: Date | null;
  metadata?: Record<string, unknown> | null;
};

export type ScheduleFollowUpEmailInput = {
  actorUserId: string;
  threadId?: string | null;
  toEmail: string;
  subject: string;
  body: string;
  sendAt: Date;
  metadata?: Record<string, unknown> | null;
  fromEmail?: string;
};

function normalizeThreadSubject(subject: string) {
  return subject.replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "").trim().toLowerCase();
}

function normalizeMessageId(value?: string | null) {
  return value?.trim().replace(/^<|>$/g, "") || null;
}

function formatMessageIdHeader(value?: string | null) {
  const normalized = normalizeMessageId(value);
  return normalized ? `<${normalized}>` : undefined;
}

function decodeQuotedPrintable(text: string) {
  return text
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/=\r?\n/g, "");
}

function stripLeadingHeaders(text: string) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const headerPattern = /^[A-Za-z0-9-]+:\s?.*$/;

  let index = 0;
  let sawHeader = false;

  while (index < lines.length) {
    const line = lines[index];
    if (headerPattern.test(line)) {
      sawHeader = true;
      index += 1;
      continue;
    }

    if (sawHeader && (/^\s+/.test(line) || line.trim() === "")) {
      index += 1;
      continue;
    }

    break;
  }

  return sawHeader ? lines.slice(index).join("\n") : normalized;
}

function stripTransportNoise(text: string) {
  return text
    .replace(/^--[a-zA-Z0-9_.=-]+\s*$/gm, "")
    .replace(/^(Content-Type|Content-Transfer-Encoding|Content-Disposition|MIME-Version|BODY\[TEXT\]|Return-Path|Delivered-To|Received|Authentication-Results|Received-SPF|ARC-Seal|ARC-Message-Signature|ARC-Authentication-Results|DKIM-Signature|X-Google-DKIM-Signature|X-Gm-Message-State|X-Gm-Gg|X-Received|X-Spam-Score|X-Spam-Report|Message-ID|References|In-Reply-To):?.*(\n\s.*)*$/gim, "")
    .replace(/^Symbol:.*$/gim, "")
    .replace(/^Action:.*$/gim, "");
}

function htmlToText(text: string) {
  if (!(text.includes("<html") || text.includes("<body") || text.includes("<div") || text.includes("<p"))) {
    return text;
  }

  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractHeader(source: string, headerName: string) {
  const match = source.match(new RegExp(`^${headerName}:\\s*(.+(?:\\r?\\n[ \\t].+)*)`, "im"));
  return match ? match[1].replace(/\r?\n[ \t]+/g, " ").trim() : null;
}

function extractMultipartTextPart(source: string, mimeType: "text/plain" | "text/html") {
  const contentTypeHeader = extractHeader(source, "Content-Type");
  const boundaryMatch = contentTypeHeader?.match(/boundary="?([^";]+)"?/i);
  const boundary = boundaryMatch?.[1];
  if (!boundary) {
    return null;
  }

  const parts = source.split(`--${boundary}`);
  for (const part of parts) {
    if (!new RegExp(`Content-Type:\\s*${mimeType}`, "i").test(part)) {
      continue;
    }

    const [, body = ""] = part.split(/\r?\n\r?\n/);
    const transferEncoding = extractHeader(part, "Content-Transfer-Encoding")?.toLowerCase();
    const decoded = transferEncoding?.includes("quoted-printable") ? decodeQuotedPrintable(body) : body;
    return decoded.trim();
  }

  return null;
}

function trimReplyToLatestMessage(text: string) {
  const separators = [
    /\nOn .+ wrote:\n?/i,
    /\nFrom:\s.+\nSent:\s.+\nTo:\s.+\nSubject:\s.+/i,
    /\n-{2,}\s*Original Message\s*-{2,}/i,
    /\n>+/,
  ];

  let result = text;
  for (const separator of separators) {
    const match = separator.exec(result);
    if (match && match.index > 0) {
      result = result.slice(0, match.index).trim();
    }
  }

  return result.trim();
}

function cleanInboundEmailBody(raw: string) {
  const preferredBody =
    extractMultipartTextPart(raw, "text/plain") ||
    htmlToText(extractMultipartTextPart(raw, "text/html") || "") ||
    raw;

  let text = preferredBody;
  text = decodeQuotedPrintable(text);
  text = text.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, "");
  text = stripLeadingHeaders(text);
  text = stripTransportNoise(text);
  text = htmlToText(text);
  text = trimReplyToLatestMessage(text);

  return text
    .replace(/\n[ \t]+\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getUserEmailDailyLimit(plan: SubscriptionPlan, isSuperAdmin = false) {
  if (isSuperAdmin) return Number.POSITIVE_INFINITY;
  if (plan === "ai_lead_gen" || plan === "base") return USER_EMAIL_DAILY_LIMIT;
  return 0;
}

function getStartOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function threadControlSettingKey(threadId: string) {
  return `email.thread.${threadId}.controls`;
}

function scheduledFollowUpSettingKey(id: string) {
  return `email.followup.${id}`;
}

function resolveSubscriptionPlan(input: {
  subscriptions?: Array<{ planName: SubscriptionPlan; status: string }>;
}) {
  const active = input.subscriptions?.find((entry) => entry.status === "active" || entry.status === "trialing");
  return active?.planName ?? "base";
}

function formatHumanReviewEmailBody(input: HumanReviewEmailInput) {
  const sections = [
    "Human review is required for an automated workflow.",
    "",
    `Subject: ${input.subject}`,
    `Summary: ${input.summary}`,
    input.reason ? `Reason: ${input.reason}` : null,
    input.relatedEntityType ? `Entity Type: ${input.relatedEntityType}` : null,
    input.relatedEntityId ? `Entity ID: ${input.relatedEntityId}` : null,
    input.actorUserId ? `Requested By User ID: ${input.actorUserId}` : null,
    "",
    "Details:",
    input.details?.trim() || "No additional details were provided.",
    input.metadata ? "" : null,
    input.metadata ? "Metadata:" : null,
    input.metadata ? JSON.stringify(input.metadata, null, 2) : null,
    "",
    "Please review and respond manually if needed.",
  ];

  return sections.filter((value): value is string => value !== null).join("\n");
}

async function getBootstrapAdminSenderContext() {
  const adminEmail = appConfig.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: {
      roles: { include: { role: true } },
      subscriptions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!admin) {
    throw new Error(`Bootstrap admin account not found for ${adminEmail}`);
  }

  return {
    id: admin.id,
    email: admin.email,
    subscriptionPlan: resolveSubscriptionPlan(admin),
    isSuperAdmin: admin.roles.some((entry) => entry.role.name === "super_admin"),
  };
}

async function getUserSenderContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: true } },
      subscriptions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!user || !user.isActive) {
    throw new Error("User account not found or inactive");
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    subscriptionPlan: resolveSubscriptionPlan(user),
    isSuperAdmin: user.roles.some((entry) => entry.role.name === "super_admin"),
  };
}

async function resolveAssignedUserId(input: { threadId?: string | null; userId?: string | null }) {
  if (input.userId) {
    return input.userId;
  }

  if (!input.threadId) {
    return null;
  }

  const latestOutgoing = await prisma.emailMessage.findFirst({
    where: {
      threadId: input.threadId,
      direction: EmailDirection.outgoing,
      sentByUserId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { sentByUserId: true },
  });

  if (latestOutgoing?.sentByUserId) {
    return latestOutgoing.sentByUserId;
  }

  const thread = await prisma.emailThread.findUnique({
    where: { id: input.threadId },
    select: { organizationId: true },
  });

  return thread?.organizationId ?? null;
}

async function getThreadControls(threadId: string) {
  const setting = await prisma.appSetting.findUnique({
    where: { key: threadControlSettingKey(threadId) },
  });

  if (!setting || typeof setting.value !== "object" || !setting.value || Array.isArray(setting.value)) {
    return {
      autoReplyPaused: false,
      reason: null as string | null,
      pausedUntil: null as string | null,
      pausedAt: null as string | null,
      pausedByUserId: null as string | null,
      metadata: null as Prisma.InputJsonValue | null,
    };
  }

  const value = setting.value as Record<string, unknown>;
  return {
    autoReplyPaused: value.autoReplyPaused === true,
    reason: typeof value.reason === "string" ? value.reason : null,
    pausedUntil: typeof value.pausedUntil === "string" ? value.pausedUntil : null,
    pausedAt: typeof value.pausedAt === "string" ? value.pausedAt : null,
    pausedByUserId: typeof value.pausedByUserId === "string" ? value.pausedByUserId : null,
    metadata: (value.metadata ?? null) as Prisma.InputJsonValue | null,
  };
}

async function isAutoReplyPausedForThread(threadId: string) {
  const controls = await getThreadControls(threadId);
  if (!controls.autoReplyPaused) {
    return false;
  }

  if (!controls.pausedUntil) {
    return true;
  }

  return new Date(controls.pausedUntil).getTime() > Date.now();
}

async function processScheduledFollowUps() {
  const dueItems = await prisma.appSetting.findMany({
    where: {
      key: { startsWith: "email.followup." },
    },
  });

  let processed = 0;

  for (const item of dueItems) {
    if (typeof item.value !== "object" || !item.value || Array.isArray(item.value)) {
      continue;
    }

    const payload = item.value as Record<string, unknown>;
    const status = typeof payload.status === "string" ? payload.status : "scheduled";
    const sendAt = typeof payload.sendAt === "string" ? payload.sendAt : null;
    if (status !== "scheduled" || !sendAt || new Date(sendAt).getTime() > Date.now()) {
      continue;
    }

    try {
      await sendEmail({
        userId: String(payload.actorUserId ?? ""),
        subscriptionPlan: String(payload.subscriptionPlan ?? "base") as SubscriptionPlan,
        isSuperAdmin: payload.isSuperAdmin === true,
        toEmail: String(payload.toEmail ?? ""),
        subject: String(payload.subject ?? ""),
        body: String(payload.body ?? ""),
        threadId: typeof payload.threadId === "string" ? payload.threadId : undefined,
        fromEmail: typeof payload.fromEmail === "string" ? payload.fromEmail : undefined,
      });

      await prisma.appSetting.update({
        where: { key: item.key },
        data: {
          value: {
            ...payload,
            status: "sent",
            sentAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      processed += 1;
    } catch (error) {
      await prisma.appSetting.update({
        where: { key: item.key },
        data: {
          value: {
            ...payload,
            status: "failed",
            failedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : "Unknown follow-up error",
          } as Prisma.InputJsonValue,
        },
      });
    }
  }

  return processed;
}

async function getMailboxSentCountToday(configId: string) {
  return prisma.emailMessage.count({
    where: {
      direction: EmailDirection.outgoing,
      organizationId: configId,
      createdAt: { gte: getStartOfToday() },
    },
  });
}

async function getUserSentCountToday(userId: string) {
  return prisma.emailMessage.count({
    where: {
      direction: EmailDirection.outgoing,
      sentByUserId: userId,
      createdAt: { gte: getStartOfToday() },
    },
  });
}

async function findOrCreateThread(userId: string, subject: string, leadEmail?: string) {
  const normalized = normalizeThreadSubject(subject);

  if (leadEmail) {
    const cleanLeadEmail = leadEmail.trim().toLowerCase();
    const existing = await prisma.emailThread.findFirst({
      where: {
        organizationId: userId,
        subject: {
          equals: normalized,
        },
        messages: {
          some: {
            OR: [
              { fromEmail: { equals: cleanLeadEmail } },
              { toEmail: { equals: cleanLeadEmail } },
            ],
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      return existing;
    }
  } else {
    const existing = await prisma.emailThread.findFirst({
      where: {
        organizationId: userId,
        subject: {
          equals: normalized,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      return existing;
    }
  }

  return prisma.emailThread.create({
    data: {
      organizationId: userId,
      subject: normalized,
    },
  });
}

async function findThreadForIncomingEmail(input: {
  userId: string;
  subject: string;
  inReplyTo?: string | null;
  references?: string[];
  leadEmail?: string;
}) {
  const candidateIds = [input.inReplyTo, ...(input.references || [])]
    .map((value) => normalizeMessageId(value))
    .filter((value): value is string => Boolean(value));

  if (candidateIds.length > 0) {
    const existingMessage = await prisma.emailMessage.findFirst({
      where: {
        threadId: { not: null },
        providerMessageId: { in: candidateIds },
      },
      select: {
        threadId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingMessage?.threadId) {
      return existingMessage.threadId;
    }
  }

  const thread = await findOrCreateThread(input.userId, input.subject, input.leadEmail);
  return thread.id;
}

async function reserveMailboxForUser(userId: string) {
  const configs = await getSmtpConfigs();
  const candidates = configs.filter((item) => item.isActive && !item.ownerUserId && !item.assignedUserId);

  if (candidates.length === 0) {
    throw new Error("No free email mailbox is available right now");
  }

  const imapReady = candidates.filter((item) => isImapConfigured(item));
  const selected = pickRandom(imapReady.length > 0 ? imapReady : candidates);

  const next = applyDefaultRule(
    configs.map((item) =>
      item.id === selected.id
        ? {
            ...item,
            assignedUserId: userId,
            assignedAt: new Date().toISOString(),
          }
        : item,
    ),
  );

  await saveSmtpConfigs(next);
  return next.find((item) => item.id === selected.id) ?? selected;
}

async function getAvailableAssignedMailboxes(userId: string) {
  const assigned = (await getSmtpConfigs()).filter(
    (item) => item.isActive && item.assignedUserId === userId,
  );

  const usage = await Promise.all(
    assigned.map(async (item) => ({
      config: item,
      sentToday: await getMailboxSentCountToday(item.id),
    })),
  );

  return usage
    .filter(({ config, sentToday }) => sentToday < (config.dailySendLimit ?? 50))
    .map(({ config }) => config);
}

export async function selectMailboxForUser(userId: string) {
  const configs = (await getSmtpConfigs()) as SmtpConfig[];
  let userMailboxes: SmtpConfig[] = configs.filter(
    (item) => item.isActive && (item.ownerUserId === userId || item.assignedUserId === userId)
  );

  if (userMailboxes.length === 0) {
    try {
      const reserved = (await reserveMailboxForUser(userId)) as SmtpConfig;
      userMailboxes = [reserved];
    } catch {
      throw new Error("No free email mailbox available");
    }
  }

  const usage = await Promise.all(
    userMailboxes.map(async (mailbox) => {
      const sentToday = await getMailboxSentCountToday(mailbox.id);
      return { mailbox, sentToday };
    })
  );

  const available = usage.filter(
    ({ mailbox, sentToday }) => sentToday < (mailbox.dailySendLimit ?? 50)
  );

  if (available.length === 0) {
    try {
      const reserved = (await reserveMailboxForUser(userId)) as SmtpConfig;
      const sentToday = await getMailboxSentCountToday(reserved.id);
      if (sentToday < (reserved.dailySendLimit ?? 50)) {
        return reserved;
      }
    } catch {
      // ignore and throw standard error
    }
    throw new Error("No free email mailbox available");
  }

  available.sort((a, b) => a.sentToday - b.sentToday);
  return available[0].mailbox;
}

async function syncMailbox(config: SmtpConfig) {
  if (!config.assignedUserId || !isImapConfigured(config)) {
    return 0;
  }

  const syncState = await prisma.inboundMailboxSync.upsert({
    where: { id: config.id },
    update: {
      status: "running",
      lastRunAt: new Date(),
      lastError: null,
    },
    create: {
      id: config.id,
      mailbox: "INBOX",
      status: "running",
      lastRunAt: new Date(),
    },
  });

  const client = new ImapFlow({
    host: config.imapHost!,
    port: config.imapPort ?? 993,
    secure: typeof config.imapSecure === "boolean" ? config.imapSecure : true,
    logger: false,
    auth: {
      user: config.imapUser!,
      pass: config.imapPass!,
    },
  });
  const handleClientError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown IMAP client error";
    logger.warn("IMAP mailbox sync client error", {
      mailboxId: config.id,
      mailbox: config.fromEmail,
      message,
    });
  };
  client.on("error", handleClientError);

  let imported = 0;
  let highestUid = syncState.lastUid ?? 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock(syncState.mailbox);

    try {
      const mailboxInfo = client.mailbox;

      if (!mailboxInfo || mailboxInfo.exists === 0) {
        highestUid = syncState.lastUid ?? 0;
      } else if (syncState.lastUid && mailboxInfo.uidNext && mailboxInfo.uidNext <= syncState.lastUid + 1) {
        highestUid = syncState.lastUid;
      } else {
        const range = syncState.lastUid ? `${syncState.lastUid + 1}:*` : "1:*";

        try {
          for await (const message of client.fetch(range, { uid: true, envelope: true, source: true })) {
            highestUid = Math.max(highestUid, message.uid);

            const providerMessageId =
              normalizeMessageId(message.envelope?.messageId) || `${config.id}:uid:${message.uid}`;
            const existing = await prisma.emailMessage.findUnique({
              where: { providerMessageId },
            });
            if (existing) {
              continue;
            }

            // Prevent importing older emails from previous server/testing profiles (2-3 weeks ago)
            const messageDate = message.envelope?.date ? new Date(message.envelope.date) : null;
            if (messageDate && messageDate.getTime() < new Date("2026-06-21T00:00:00Z").getTime()) {
              continue;
            }

            const subject = message.envelope?.subject || "(No subject)";
            const fromEmail = message.envelope?.from?.[0]?.address || "unknown@unknown.com";
            const toEmail = message.envelope?.to?.[0]?.address || config.fromEmail;
            const rawBody = message.source?.toString("utf8") || "";
            const inReplyTo = normalizeMessageId(extractHeader(rawBody, "In-Reply-To"));
            const references = (extractHeader(rawBody, "References") || "")
              .split(/\s+/)
              .map((value) => normalizeMessageId(value))
              .filter((value): value is string => Boolean(value));
            const body = cleanInboundEmailBody(rawBody) || rawBody;
            const threadId = await findThreadForIncomingEmail({
              userId: config.assignedUserId,
              subject,
              inReplyTo,
              references,
              leadEmail: fromEmail,
            });

            try {
              const createdMessage = await prisma.emailMessage.create({
                data: {
                  organizationId: config.id,
                  threadId,
                  providerMessageId,
                  subject,
                  body,
                  fromEmail,
                  toEmail,
                  direction: EmailDirection.incoming,
                  isRead: false,
                  inReplyTo,
                },
              });

              try {
                const autoReply = await prepareAiAutoReply({
                  incomingMessageId: createdMessage.id,
                  fallbackUserId: config.assignedUserId,
                });

                if (autoReply) {
                  await sendEmail({
                    userId: autoReply.userId,
                    subscriptionPlan: autoReply.subscriptionPlan,
                    isSuperAdmin: autoReply.isSuperAdmin,
                    toEmail: autoReply.toEmail,
                    subject: autoReply.subject,
                    body: autoReply.body,
                    threadId: autoReply.threadId,
                    replyToMessageId: autoReply.replyToMessageId,
                    references: autoReply.references,
                    fromEmail: autoReply.fromEmail,
                  });

                  logger.info("AI auto-reply sent", {
                    threadId: autoReply.threadId,
                    userId: autoReply.userId,
                    provider: autoReply.provider,
                    model: autoReply.model,
                    toEmail: autoReply.toEmail,
                  });
                }
              } catch (error) {
                logger.warn("AI auto-reply failed", {
                  messageId: createdMessage.id,
                  threadId: createdMessage.threadId,
                  message: error instanceof Error ? error.message : "Unknown AI auto-reply error",
                });
              }
            } catch (error) {
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
              ) {
                continue;
              }
              throw error;
            }

            imported += 1;
          }
        } catch (fetchError: any) {
          const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
          if (msg.includes("Command failed") || msg.includes("NO")) {
            logger.info("IMAP fetch range returned no messages or failed silently", {
              mailbox: config.fromEmail,
              range,
              message: msg,
            });
          } else {
            throw fetchError;
          }
        }
      }
    } finally {
      lock.release();
    }

    await prisma.inboundMailboxSync.update({
      where: { id: syncState.id },
      data: {
        status: "idle",
        lastUid: highestUid || null,
        lastRunAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    await prisma.inboundMailboxSync.update({
      where: { id: syncState.id },
      data: {
        status: "failed",
        lastError: error instanceof Error ? error.message : "Unknown sync error",
      },
    });
    throw error;
  } finally {
    await client.logout().catch(() => undefined);
    client.removeListener("error", handleClientError);
  }

  return imported;
}

export async function sendEmail(input: {
  userId: string;
  subscriptionPlan: SubscriptionPlan;
  isSuperAdmin?: boolean;
  toEmail: string;
  subject: string;
  body: string;
  threadId?: string;
  replyToMessageId?: string | null;
  references?: string[];
  fromEmail?: string;
  isHtml?: boolean;
}) {
  const dailyLimit = getUserEmailDailyLimit(input.subscriptionPlan, input.isSuperAdmin);
  if (dailyLimit <= 0) {
    throw new Error("Email access requires Tier Two or higher");
  }

  if (input.subscriptionPlan === "base" && !input.isSuperAdmin) {
    const lifetimeSent = await getUserSentCountLifetime(input.userId);
    if (lifetimeSent >= 20) {
      throw new Error("Free tier limit reached. Please upgrade to send more emails.");
    }
  }

  const userSentToday = await getUserSentCountToday(input.userId);
  if (userSentToday >= dailyLimit) {
    throw new Error(`Daily email limit reached (${dailyLimit}/day)`);
  }

  let mailbox: SmtpConfig;
  if (input.fromEmail) {
    const configs = await getSmtpConfigs();
    const matched = configs.find(
      (c) => c.isActive && c.fromEmail.trim().toLowerCase() === input.fromEmail!.trim().toLowerCase()
    );
    if (!matched) {
      throw new Error(`Configured mailbox for ${input.fromEmail} was not found or is inactive`);
    }
    const sentToday = await getMailboxSentCountToday(matched.id);
    if (sentToday >= (matched.dailySendLimit ?? 50)) {
      throw new Error(`Mailbox ${matched.fromEmail} daily email limit reached (${matched.dailySendLimit ?? 50})`);
    }
    mailbox = matched;
  } else {
    mailbox = await selectMailboxForUser(input.userId);
  }
  const transport = createTransportForConfig(mailbox);
  const result = await transport.sendMail({
    from: mailbox.fromEmail,
    to: input.toEmail,
    subject: input.subject,
    text: input.isHtml ? undefined : input.body,
    html: input.isHtml ? input.body : undefined,
    inReplyTo: formatMessageIdHeader(input.replyToMessageId),
    references: input.references
      ?.map((value) => formatMessageIdHeader(value))
      .filter((value): value is string => Boolean(value)),
  });

  const thread = input.threadId
    ? await prisma.emailThread.findUnique({ where: { id: input.threadId } })
    : await findOrCreateThread(input.userId, input.subject, input.toEmail);

  const resolvedThreadId = thread?.id ?? (await findOrCreateThread(input.userId, input.subject, input.toEmail)).id;
  const message = await prisma.emailMessage.create({
    data: {
      organizationId: mailbox.id,
      threadId: resolvedThreadId,
      sentByUserId: input.userId,
      providerMessageId: normalizeMessageId(result.messageId) || undefined,
      subject: input.subject,
      body: input.body,
      fromEmail: mailbox.fromEmail,
      toEmail: input.toEmail,
      direction: EmailDirection.outgoing,
      isRead: true,
      inReplyTo: normalizeMessageId(input.replyToMessageId),
    },
  });

  await writeAuditLog({
    actorUserId: input.userId,
    action: "emails.send",
    entityType: "email_message",
    entityId: message.id,
    metadata: {
      mailboxConfigId: mailbox.id,
      mailboxName: mailbox.name,
    },
  });

  return message;
}

export async function emailAdminForHumanReview(input: HumanReviewEmailInput) {
  const admin = await getBootstrapAdminSenderContext();

  // Resolve the target user email – the person who should be notified
  let recipientEmail = admin.email; // default fallback: admin
  if (input.actorUserId) {
    try {
      const userCtx = await getUserSenderContext(input.actorUserId);
      recipientEmail = userCtx.email;
    } catch {
      // fallback to bootstrap admin email if user lookup fails
    }
  }

  let item: { id: string } | null = null;
  try {
    // Always send from the admin mailbox to avoid consuming the user's daily quota
    item = await sendEmail({
      userId: admin.id,
      subscriptionPlan: admin.subscriptionPlan,
      isSuperAdmin: admin.isSuperAdmin,
      toEmail: recipientEmail,
      subject: `[Human Review Required] ${input.subject}`,
      body: formatHumanReviewEmailBody(input),
    });
  } catch (error) {
    logger.error("Failed to send human review notification email", {
      recipientEmail,
      actorUserId: input.actorUserId ?? null,
      message: error instanceof Error ? error.message : "Unknown email error",
    });
  }

  await writeAuditLog({
    actorUserId: input.actorUserId ?? admin.id,
    action: "emails.human_review_requested",
    entityType: input.relatedEntityType ?? "email_message",
    entityId: input.relatedEntityId ?? item?.id ?? "unknown",
    metadata: {
      adminEmail: admin.email,
      recipientEmail,
      source: "agent_email_tool",
      summary: input.summary,
      reason: input.reason ?? null,
      metadata: (input.metadata ?? null) as Prisma.InputJsonValue | null,
    },
  });

  return item;
}

export async function lookupLeadContext(input: LookupLeadContextInput) {
  let senderEmail = input.senderEmail?.trim().toLowerCase() || null;

  if (!senderEmail && input.threadId) {
    const latestIncoming = await prisma.emailMessage.findFirst({
      where: {
        threadId: input.threadId,
        direction: EmailDirection.incoming,
      },
      orderBy: { createdAt: "desc" },
      select: { fromEmail: true },
    });
    senderEmail = latestIncoming?.fromEmail.trim().toLowerCase() ?? null;
  }

  if (!senderEmail) {
    return null;
  }

  const lead = await prisma.lead.findFirst({
    where: {
      email: { equals: senderEmail },
      campaign: {
        is: {
          createdById: input.userId,
        },
      },
    },
    include: {
      campaign: true,
    },
    orderBy: {
      campaign: {
        createdAt: "desc",
      },
    },
  });

  if (!lead) {
    return null;
  }

  return {
    lead: {
      id: lead.id,
      name: lead.name,
      business: lead.business,
      email: lead.email,
      phone: lead.phone,
      website: lead.website,
      industry: lead.industry,
      location: lead.location,
      status: lead.status,
      outreachEnabled: lead.outreachEnabled,
    },
    campaign: lead.campaign
      ? {
          id: lead.campaign.id,
          source: lead.campaign.source,
          businessType: lead.campaign.businessType,
          status: lead.campaign.status,
          createdAt: lead.campaign.createdAt.toISOString(),
          externalResponse: lead.campaign.externalResponse,
        }
      : null,
  };
}

export async function notifyAssignedUser(input: NotifyAssignedUserInput) {
  const assignedUserId = await resolveAssignedUserId({
    threadId: input.threadId,
    userId: input.userId,
  });

  if (!assignedUserId) {
    throw new Error("No assigned user could be resolved");
  }

  const sender = await getBootstrapAdminSenderContext();
  const assignedUser = await getUserSenderContext(assignedUserId);
  const message = await sendEmail({
    userId: sender.id,
    subscriptionPlan: sender.subscriptionPlan,
    isSuperAdmin: sender.isSuperAdmin,
    toEmail: assignedUser.email,
    subject: `[Action Needed] ${input.subject}`,
    body: [
      `Hello ${assignedUser.displayName},`,
      "",
      input.summary,
      "",
      input.details?.trim() || "No additional details were provided.",
      input.threadId ? `Thread ID: ${input.threadId}` : null,
      input.metadata ? "" : null,
      input.metadata ? "Metadata:" : null,
      input.metadata ? JSON.stringify(input.metadata, null, 2) : null,
    ].filter((value): value is string => value !== null).join("\n"),
  });

  await writeAuditLog({
    actorUserId: input.actorUserId ?? sender.id,
    action: "emails.notify_assigned_user",
    entityType: "email_message",
    entityId: message.id,
    metadata: {
      assignedUserId,
      assignedUserEmail: assignedUser.email,
      threadId: input.threadId ?? null,
      summary: input.summary,
      metadata: (input.metadata ?? null) as Prisma.InputJsonValue | null,
    },
  });

  return message;
}

export async function createAdminTask(input: CreateAdminTaskInput) {
  const taskId = `admin-task:${crypto.randomUUID()}`;

  await writeAuditLog({
    actorUserId: input.actorUserId ?? null,
    action: "admin.task.create",
    entityType: input.relatedEntityType ?? "admin_task",
    entityId: input.relatedEntityId ?? taskId,
    metadata: {
      taskId,
      title: input.title,
      summary: input.summary,
      priority: input.priority ?? "normal",
      status: "open",
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      metadata: (input.metadata ?? null) as Prisma.InputJsonValue | null,
    },
  });

  return {
    id: taskId,
    title: input.title,
    summary: input.summary,
    priority: input.priority ?? "normal",
    status: "open" as const,
  };
}

export async function pauseAutoReplyForThread(input: PauseAutoReplyForThreadInput) {
  const nextValue = {
    autoReplyPaused: true,
    reason: input.reason,
    pausedAt: new Date().toISOString(),
    pausedUntil: input.pausedUntil?.toISOString() ?? null,
    pausedByUserId: input.actorUserId ?? null,
    metadata: (input.metadata ?? null) as Prisma.InputJsonValue | null,
  } satisfies Prisma.InputJsonObject;

  await prisma.appSetting.upsert({
    where: { key: threadControlSettingKey(input.threadId) },
    update: { value: nextValue },
    create: {
      key: threadControlSettingKey(input.threadId),
      scope: "thread",
      value: nextValue,
    },
  });

  await writeAuditLog({
    actorUserId: input.actorUserId ?? null,
    action: "emails.auto_reply.pause",
    entityType: "email_thread",
    entityId: input.threadId,
    metadata: nextValue,
  });

  return { threadId: input.threadId, paused: true, pausedUntil: nextValue.pausedUntil };
}

export async function scheduleFollowUpEmail(input: ScheduleFollowUpEmailInput) {
  const sender = await getUserSenderContext(input.actorUserId);
  const itemId = crypto.randomUUID();
  const value = {
    actorUserId: sender.id,
    subscriptionPlan: sender.subscriptionPlan,
    isSuperAdmin: sender.isSuperAdmin,
    threadId: input.threadId ?? null,
    toEmail: input.toEmail,
    subject: input.subject,
    body: input.body,
    sendAt: input.sendAt.toISOString(),
    status: "scheduled",
    createdAt: new Date().toISOString(),
    metadata: (input.metadata ?? null) as Prisma.InputJsonValue | null,
    fromEmail: input.fromEmail ?? null,
  } satisfies Prisma.InputJsonObject;

  await prisma.appSetting.create({
    data: {
      key: scheduledFollowUpSettingKey(itemId),
      scope: "email_followup",
      value,
    },
  });

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: "emails.followup.schedule",
    entityType: "email_followup",
    entityId: itemId,
    metadata: value,
  });

  return { id: itemId, status: "scheduled" as const, sendAt: value.sendAt };
}

export const agentEmailTools = {
  emailAdminForHumanReview,
  notifyAssignedUser,
  scheduleFollowUpEmail,
  lookupLeadContext,
  createAdminTask,
  pauseAutoReplyForThread,
};

export async function syncInbox(userId?: string) {
  if (activeSync) {
    return activeSync;
  }

  activeSync = (async () => {
    const targets = (await getSmtpConfigs()).filter(
      (item) =>
        item.isActive &&
        item.assignedUserId &&
        (!userId || item.assignedUserId === userId) &&
        isImapConfigured(item),
    );

    let imported = 0;

    for (const target of targets) {
      try {
        imported += await syncMailbox(target);
      } catch (error) {
        logger.error(`Error syncing mailbox ${target.fromEmail}:`, error instanceof Error ? error.message : error);
      }
    }

    const scheduledFollowUpsProcessed = await processScheduledFollowUps();

    try {
      await resumeAndProcessCampaigns();
    } catch (err) {
      logger.error("Failed to process outreach campaigns during inbox sync", err);
    }

    await writeAuditLog({
      actorUserId: userId ?? null,
      action: "emails.sync",
      entityType: "mailbox_sync",
      entityId: userId ?? "background",
      metadata: {
        imported,
        mailboxCount: targets.length,
        scheduledFollowUpsProcessed,
      },
    });

    return { imported };
  })();

  try {
    return await activeSync;
  } finally {
    activeSync = null;
  }
}

export async function getUserSentCountLifetime(userId: string) {
  return prisma.emailMessage.count({
    where: {
      direction: EmailDirection.outgoing,
      sentByUserId: userId,
    },
  });
}

export function canAccessEmail(plan: SubscriptionPlan) {
  return plan === "ai_lead_gen" || plan === "base";
}

export function startBackgroundEmailSync() {
  if (backgroundSyncTask) {
    return () => undefined;
  }

  if (!appConfig.EMAIL_BACKGROUND_SYNC_ENABLED) {
    logger.info("Background email sync is disabled");
    return () => undefined;
  }

  const runSync = async () => {
    try {
      const result = await syncInbox();
      if (result.imported > 0) {
        logger.info(`Background email sync imported ${result.imported} message(s)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error";
      logger.warn("Background email sync failed", message);
    }
  };

  backgroundSyncTask = cron.schedule("* * * * *", () => {
    void runSync();
  });

  void runSync();
  logger.info("Background email sync started with node-cron (every 1 minute)");

  return () => {
    if (!backgroundSyncTask) return;
    backgroundSyncTask.stop();
    backgroundSyncTask = null;
  };
}
