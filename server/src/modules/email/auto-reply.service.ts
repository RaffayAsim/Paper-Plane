import type { SubscriptionPlan } from "../../lib/access.js";
import { generateAiThreadReply } from "../../lib/ai-provider.js";
import { getUserAiBrandProfile } from "../../lib/ai-brand-profile.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { getSmtpConfigs } from "../../lib/email-settings.js";
import {
  createAdminTask,
  emailAdminForHumanReview,
  lookupLeadContext,
  notifyAssignedUser,
  pauseAutoReplyForThread,
  scheduleFollowUpEmail,
} from "./email.service.js";

async function getCampaignContextForReply(userId: string, senderEmail: string) {
  const normalizedEmail = senderEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const lead = await prisma.lead.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
      },
      campaign: {
        is: {
          createdById: userId,
          businessType: "AI Email Automation",
        },
      },
    },
    select: {
      id: true,
      source: true,
      campaign: {
        select: {
          id: true,
          source: true,
          createdAt: true,
          externalResponse: true,
        },
      },
    },
    orderBy: {
      campaign: {
        createdAt: "desc",
      },
    },
  });

  if (!lead?.campaign) {
    return null;
  }

  const responseState = (lead.campaign.externalResponse as Record<string, unknown> | null) ?? {};
  const campaignBrief = typeof responseState.pitch === "string" ? responseState.pitch.trim() : "";

  return {
    leadId: lead.id,
    leadSource: lead.source,
    campaignId: lead.campaign.id,
    campaignSource: lead.campaign.source,
    campaignCreatedAt: lead.campaign.createdAt.toISOString(),
    campaignBrief: campaignBrief || null,
  };
}

export async function prepareAiAutoReply(input: {
  incomingMessageId: string;
  fallbackUserId?: string | null;
}) {
  const incomingMessage = await prisma.emailMessage.findUnique({
    where: { id: input.incomingMessageId },
  });

  if (!incomingMessage?.threadId || incomingMessage.direction !== "incoming") {
    return null;
  }

  const threadControls = await prisma.appSetting.findUnique({
    where: { key: `email.thread.${incomingMessage.threadId}.controls` },
  });
  if (
    threadControls?.value &&
    typeof threadControls.value === "object" &&
    !Array.isArray(threadControls.value) &&
    (threadControls.value as Record<string, unknown>).autoReplyPaused === true
  ) {
    logger.info("AI auto-reply skipped because thread is paused", {
      threadId: incomingMessage.threadId,
      incomingMessageId: incomingMessage.id,
    });
    return null;
  }

  const threadMessages = await prisma.emailMessage.findMany({
    where: { threadId: incomingMessage.threadId },
    orderBy: { createdAt: "asc" },
  });

  const priorOutgoing = [...threadMessages]
    .reverse()
    .find((message) => message.direction === "outgoing" && message.id !== incomingMessage.id);

  if (!priorOutgoing?.sentByUserId && !input.fallbackUserId) {
    return null;
  }

  const userId = priorOutgoing?.sentByUserId ?? input.fallbackUserId ?? null;
  if (!userId) {
    return null;
  }

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
    return null;
  }

  const activeSubscription = user.subscriptions.find((item) => item.status === "active" || item.status === "trialing");
  const subscriptionPlan = (activeSubscription?.planName as SubscriptionPlan | undefined) ?? "base";
  const isSuperAdmin = user.roles.some((entry) => entry.role.name === "super_admin");

  if (!isSuperAdmin && subscriptionPlan !== "ai_lead_gen") {
    return null;
  }

  const brandProfile = await getUserAiBrandProfile(user.id);
  if (!brandProfile?.autoReplyEnabled) {
    return null;
  }

  const campaignContext = await getCampaignContextForReply(user.id, incomingMessage.fromEmail);
  const leadContext = await lookupLeadContext({
    userId: user.id,
    senderEmail: incomingMessage.fromEmail,
    threadId: incomingMessage.threadId,
  });

  const smtpConfigs = await getSmtpConfigs();
  const mailboxConfig = smtpConfigs.find(
    (c) => c.isActive && c.fromEmail.trim().toLowerCase() === incomingMessage.toEmail.trim().toLowerCase()
  );
  const senderName = mailboxConfig?.name || null;

  const draft = await generateAiThreadReply({
    brandProfile,
    source: campaignContext?.leadSource ?? incomingMessage.organizationId ?? "email",
    mailboxEmail: incomingMessage.toEmail,
    subject: incomingMessage.subject,
    campaignBrief: campaignContext?.campaignBrief ?? null,
    campaignContext: campaignContext
      ? {
          id: campaignContext.campaignId,
          source: campaignContext.campaignSource,
          createdAt: campaignContext.campaignCreatedAt,
        }
      : null,
    threadMessages: threadMessages.map((message) => ({
      direction: message.direction,
      fromEmail: message.fromEmail,
      toEmail: message.toEmail,
      createdAt: message.createdAt.toISOString(),
      body: message.body,
    })),
    senderName,
  }, user.id).catch((error: unknown) => {
    logger.warn("AI thread reply generation threw an error", {
      threadId: incomingMessage.threadId,
      userId: user.id,
      subject: incomingMessage.subject,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  if (!draft) {
    logger.warn("AI auto-reply skipped because no AI draft was returned", {
      threadId: incomingMessage.threadId,
      userId: user.id,
      subject: incomingMessage.subject,
    });
    return null;
  }

  const leadId = leadContext?.lead.id ?? campaignContext?.leadId ?? null;
  if (leadId && draft.interestScore != null) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { interestScore: draft.interestScore },
    }).catch((error: unknown) => {
      logger.warn("Failed to update lead interest score", {
        leadId,
        interestScore: draft.interestScore,
        message: error instanceof Error ? error.message : String(error),
      });
    });

    logger.info("Lead interest score updated from AI reply", {
      leadId,
      interestScore: draft.interestScore,
      threadId: incomingMessage.threadId,
    });
  }

  if (draft.outcome === "tool_call") {
    const commonMetadata = {
      incomingMessageId: incomingMessage.id,
      fromEmail: incomingMessage.fromEmail,
      toEmail: incomingMessage.toEmail,
      aiProvider: draft.provider,
      aiModel: draft.model,
      leadId: leadContext?.lead.id ?? campaignContext?.leadId ?? null,
      campaignId: leadContext?.campaign?.id ?? campaignContext?.campaignId ?? null,
      leadContext,
    };

    if (draft.toolCall.toolName === "pauseAutoReplyForThread") {
      await pauseAutoReplyForThread({
        actorUserId: user.id,
        threadId: incomingMessage.threadId,
        reason: draft.toolCall.reason,
        metadata: commonMetadata,
      });

      logger.info("AI auto-reply paused thread", {
        threadId: incomingMessage.threadId,
        userId: user.id,
        provider: draft.provider,
        model: draft.model,
        reason: draft.toolCall.reason,
      });
      return null;
    }

    if (draft.toolCall.toolName === "createAdminTask") {
      await createAdminTask({
        actorUserId: user.id,
        title: draft.toolCall.title,
        summary: draft.toolCall.summary,
        priority: draft.toolCall.priority,
        relatedEntityType: "email_thread",
        relatedEntityId: incomingMessage.threadId,
        metadata: commonMetadata,
      });

      logger.info("AI auto-reply created admin task", {
        threadId: incomingMessage.threadId,
        userId: user.id,
        provider: draft.provider,
        model: draft.model,
        title: draft.toolCall.title,
      });
      return null;
    }

    if (draft.toolCall.toolName === "notifyAssignedUser") {
      await notifyAssignedUser({
        actorUserId: user.id,
        threadId: incomingMessage.threadId,
        subject: draft.toolCall.subject,
        summary: draft.toolCall.summary,
        details: draft.toolCall.details,
        metadata: commonMetadata,
      });

      logger.info("AI auto-reply notified assigned user", {
        threadId: incomingMessage.threadId,
        userId: user.id,
        provider: draft.provider,
        model: draft.model,
        subject: draft.toolCall.subject,
      });
      return null;
    }

    if (draft.toolCall.toolName === "scheduleFollowUpEmail") {
      const sendAt = new Date(Date.now() + draft.toolCall.delayMinutes * 60_000);
      await scheduleFollowUpEmail({
        actorUserId: user.id,
        threadId: incomingMessage.threadId,
        toEmail: incomingMessage.fromEmail,
        subject: draft.toolCall.subject,
        body: draft.toolCall.body,
        sendAt,
        metadata: commonMetadata,
      });

      await pauseAutoReplyForThread({
        actorUserId: user.id,
        threadId: incomingMessage.threadId,
        reason: `follow_up_scheduled_${draft.toolCall.delayMinutes}m`,
        pausedUntil: sendAt,
        metadata: commonMetadata,
      });

      logger.info("AI auto-reply scheduled follow-up", {
        threadId: incomingMessage.threadId,
        userId: user.id,
        provider: draft.provider,
        model: draft.model,
        delayMinutes: draft.toolCall.delayMinutes,
      });
      return null;
    }

    if (draft.toolCall.toolName === "emailAdminForHumanReview") {
      await pauseAutoReplyForThread({
        actorUserId: user.id,
        threadId: incomingMessage.threadId,
        reason: draft.toolCall.reason,
        metadata: commonMetadata,
      });

      const adminTask = await createAdminTask({
        actorUserId: user.id,
        title: draft.toolCall.subject,
        summary: draft.toolCall.summary,
        priority: "high",
        relatedEntityType: "email_thread",
        relatedEntityId: incomingMessage.threadId,
        metadata: {
          ...commonMetadata,
          reason: draft.toolCall.reason,
        },
      });

      await notifyAssignedUser({
        actorUserId: user.id,
        threadId: incomingMessage.threadId,
        subject: draft.toolCall.subject,
        summary: draft.toolCall.summary,
        details: draft.toolCall.details,
        metadata: {
          ...commonMetadata,
          adminTaskId: adminTask.id,
        },
      }).catch((error) => {
        logger.warn("Assigned user notification failed", {
          threadId: incomingMessage.threadId,
          userId: user.id,
          message: error instanceof Error ? error.message : "Unknown assigned user notification error",
        });
      });

      await emailAdminForHumanReview({
        actorUserId: user.id,
        subject: draft.toolCall.subject,
        summary: draft.toolCall.summary,
        reason: draft.toolCall.reason,
        details: [
          draft.toolCall.details,
          "",
          `Original subject: ${incomingMessage.subject}`,
          `From: ${incomingMessage.fromEmail}`,
          `To: ${incomingMessage.toEmail}`,
          `Thread ID: ${incomingMessage.threadId}`,
          campaignContext
            ? `Campaign ID: ${campaignContext.campaignId} (${campaignContext.campaignSource})`
            : "Campaign ID: none",
        ].filter(Boolean).join("\n"),
        relatedEntityType: "email_thread",
        relatedEntityId: incomingMessage.threadId,
        metadata: {
          ...commonMetadata,
          adminTaskId: adminTask.id,
        },
      });

      logger.info("AI auto-reply escalated for human review", {
        threadId: incomingMessage.threadId,
        userId: user.id,
        subject: incomingMessage.subject,
        provider: draft.provider,
        model: draft.model,
        reason: draft.toolCall.reason,
      });
      return null;
    }
  }

  if (draft.outcome !== "reply") {
    return null;
  }

  const references = threadMessages
    .map((message) => message.providerMessageId)
    .filter((value): value is string => Boolean(value))
    .slice(-10);

  return {
    userId: user.id,
    subscriptionPlan,
    isSuperAdmin,
    toEmail: incomingMessage.fromEmail,
    subject: incomingMessage.subject,
    body: draft.body,
    threadId: incomingMessage.threadId,
    replyToMessageId: incomingMessage.providerMessageId,
    references,
    provider: draft.provider,
    model: draft.model,
    fromEmail: incomingMessage.toEmail,
  };
}
