import { LeadCampaignStatus, LeadSourceType } from "../../generated/prisma/index.js";
import { generateAiEmailDraft } from "../../lib/ai-provider.js";
import { prisma } from "../../lib/prisma.js";
import { sendEmail, selectMailboxForUser } from "../email/email.service.js";
import { getUserAiBrandProfile } from "../../lib/ai-brand-profile.js";
import type { UserAiBrandProfile } from "../../lib/ai-brand-profile.js";
import { logger } from "../../lib/logger.js";

type AutomationLead = {
  id: string;
  name: string;
  business: string;
  email: string;
  industry: string | null;
  location: string | null;
  website: string | null;
  source: LeadSourceType;
};

async function updateCampaignState(campaignId: string, updates: Record<string, unknown>, status?: LeadCampaignStatus) {
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
  const previous = (campaign?.externalResponse as Record<string, unknown> | null) ?? {};

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: {
      ...(status ? { status } : {}),
      externalResponse: {
        ...previous,
        ...updates,
      } as never,
    },
  });
}

async function getMessageWebhookUrl(source: LeadSourceType) {
  const settingKey = `integration.webhooks.${source}.message_campaign`;
  const setting = await prisma.appSetting.findUnique({ where: { key: settingKey } });
  return typeof setting?.value === "object" && setting?.value && "url" in (setting.value as Record<string, unknown>)
    ? String((setting.value as Record<string, unknown>).url ?? "")
    : "";
}

function buildFallbackDraft(lead: AutomationLead, pitch: string) {
  const subject = `A quick idea for ${lead.business}`;
  const body = [
    `Hi ${lead.name || lead.business},`,
    "",
    `I came across ${lead.business}${lead.location ? ` in ${lead.location}` : ""} and thought this might be relevant.`,
    "",
    pitch.trim(),
    "",
    lead.industry
      ? `I believe this could be a strong fit for a ${lead.industry.toLowerCase()} business like yours.`
      : "I believe this could be a strong fit for your business.",
    "",
    "If this sounds interesting, I would be happy to share a few tailored ideas for your team.",
    "",
    "Best regards,",
  ].join("\n");

  return { subject, body };
}

function fillPlaceholders(template: string, lead: any) {
  if (!template) return "";
  
  return template.replace(/\{\{([\s\S]*?)\}\}/g, (match, expression) => {
    const parts = expression.split("|");
    const key = parts[0].trim();
    const fallback = parts.length > 1 ? parts.slice(1).join("|").trim() : "";

    let val: any = undefined;
    
    // Check main lead keys first
    if (["name", "business", "location", "industry", "website"].includes(key)) {
      val = lead[key];
    } else if (lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)) {
      val = lead.metadata[key];
    }

    if (val === null || val === undefined || String(val).trim() === "") {
      return fallback;
    }

    return String(val);
  });
}

async function generateDraft(
  source: LeadSourceType,
  lead: AutomationLead,
  pitch: string,
  brandProfile?: UserAiBrandProfile | null,
  senderName?: string | null,
  senderEmail?: string | null,
  userId?: string,
) {
  try {
    const aiDraft = await generateAiEmailDraft({
      source,
      pitch,
      lead: {
        name: lead.name,
        business: lead.business,
        industry: lead.industry,
        location: lead.location,
        website: lead.website,
      },
      brandProfile,
      senderName,
      senderEmail,
    }, userId);

    if (aiDraft) {
      return {
        subject: aiDraft.subject,
        body: aiDraft.body,
        provider: aiDraft.provider,
        model: aiDraft.model,
      };
    }
  } catch {
    // Fall back to webhook/template flow if the AI provider is unavailable.
  }

  const webhookUrl = await getMessageWebhookUrl(source);
  if (!webhookUrl) {
    return { ...buildFallbackDraft(lead, pitch), provider: "fallback", model: "template" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "draft_email",
        source,
        pitch,
        lead,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      return buildFallbackDraft(lead, pitch);
    }

    try {
      const parsed = JSON.parse(raw) as { subject?: string; body?: string };
      if (parsed.subject && parsed.body) {
        return {
          subject: parsed.subject,
          body: parsed.body,
          provider: "webhook",
          model: "external",
        };
      }
    } catch {
      if (raw.trim()) {
        const fallback = buildFallbackDraft(lead, pitch);
        return {
          subject: fallback.subject,
          body: raw.trim(),
          provider: "webhook",
          model: "external",
        };
      }
    }
  } catch {
    return { ...buildFallbackDraft(lead, pitch), provider: "fallback", model: "template" };
  }

  return { ...buildFallbackDraft(lead, pitch), provider: "fallback", model: "template" };
}

export async function runMessageAutomationCampaign(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new Error("Message automation campaign not found");
  }

  const responseState = (campaign.externalResponse as Record<string, unknown> | null) ?? {};
  const leadIds = Array.isArray(responseState.leadIds) ? responseState.leadIds.filter((item): item is string => typeof item === "string") : [];
  const processedLeadIds = Array.isArray(responseState.processedLeadIds)
    ? responseState.processedLeadIds.filter((item): item is string => typeof item === "string")
    : [];
  const pitch = typeof responseState.pitch === "string" ? responseState.pitch : "";
  const campaignType = typeof responseState.campaignType === "string" ? responseState.campaignType : "ai";
  const subjectTemplate = typeof responseState.subjectTemplate === "string" ? responseState.subjectTemplate : "";
  const bodyTemplate = typeof responseState.bodyTemplate === "string" ? responseState.bodyTemplate : "";

  const pendingLeadIds = leadIds.filter((id) => !processedLeadIds.includes(id));

  if (pendingLeadIds.length === 0) {
    const sentCount = typeof responseState.sentCount === "number" ? responseState.sentCount : 0;
    const failedCount = typeof responseState.failedCount === "number" ? responseState.failedCount : 0;
    const failures = Array.isArray(responseState.failures) ? responseState.failures : [];

    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: {
        status: failedCount > 0 && sentCount === 0 ? "failed" : "completed",
        errorMessage: failedCount > 0 && sentCount === 0 ? (failures[0]?.error ?? "Campaign failed") : null,
        externalResponse: {
          ...responseState,
          completedAt: new Date().toISOString(),
        } as never,
      },
    });
    return;
  }

  const user = campaign.createdById
    ? await prisma.user.findUnique({
      where: { id: campaign.createdById },
      include: {
        roles: { include: { role: true } },
        subscriptions: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    })
    : null;

  if (!user) {
    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: {
        status: "failed",
        errorMessage: "Campaign owner not found",
      },
    });
    return;
  }

  const activeSubscription = user.subscriptions.find((item) => item.status === "active" || item.status === "trialing");
  const subscriptionPlan = activeSubscription?.planName ?? "base";
  const isSuperAdmin = user.roles.some((entry) => entry.role.name === "super_admin");
  const brandProfile = await getUserAiBrandProfile(user.id);

  const leads = await prisma.lead.findMany({
    where: {
      id: { in: pendingLeadIds },
      email: { not: null },
    },
    select: {
      id: true,
      name: true,
      business: true,
      email: true,
      industry: true,
      location: true,
      website: true,
      source: true,
      metadata: true,
    },
  });

  let sentCount = typeof responseState.sentCount === "number" ? responseState.sentCount : 0;
  let failedCount = typeof responseState.failedCount === "number" ? responseState.failedCount : 0;
  const failures = Array.isArray(responseState.failures) ? responseState.failures : [];

  await updateCampaignState(campaignId, { startedAt: new Date().toISOString() }, "processing");

  for (const lead of leads) {
    if (!lead.email) {
      failedCount += 1;
      processedLeadIds.push(lead.id);
      continue;
    }

    if (sentCount > 0 || failedCount > 0) {
      const delay = 5000 + Math.random() * 5000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const mailbox = await selectMailboxForUser(user.id);
      let subject = "";
      let body = "";
      let isHtml = false;

      if (campaignType === "manual") {
        subject = fillPlaceholders(subjectTemplate, lead as AutomationLead);
        body = fillPlaceholders(bodyTemplate, lead as AutomationLead);
        isHtml = /<\/?[a-z][\s\S]*>/i.test(body);
      } else {
        const draft = await generateDraft(
          lead.source,
          lead as AutomationLead,
          pitch,
          brandProfile,
          mailbox.name,
          mailbox.fromEmail,
          user.id,
        );
        subject = draft.subject;
        body = draft.body;
      }

      await sendEmail({
        userId: user.id,
        subscriptionPlan,
        isSuperAdmin,
        toEmail: lead.email,
        subject,
        body,
        fromEmail: mailbox.fromEmail,
        isHtml,
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: "contacted",
          outreachEnabled: true,
        },
      });

      sentCount += 1;
      processedLeadIds.push(lead.id);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown send error";
      const isQuotaError = errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("limit reached") || errMsg.toLowerCase().includes("no free email mailbox") || errMsg.toLowerCase().includes("quota is available");
      if (isQuotaError) {
        logger.info(`Campaign ${campaignId} reached daily mailbox limit during run. Pausing campaign.`);
        break;
      }

      failedCount += 1;
      failures.push({
        leadId: lead.id,
        email: lead.email,
        error: errMsg,
      });
      processedLeadIds.push(lead.id);
    }

    await updateCampaignState(campaignId, {
      processedCount: sentCount + failedCount,
      sentCount,
      failedCount,
      lastProcessedAt: new Date().toISOString(),
      failures: failures.slice(-20),
      processedLeadIds,
    });
  }

  if (processedLeadIds.length === leadIds.length) {
    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: {
        status: failedCount > 0 && sentCount === 0 ? "failed" : "completed",
        errorMessage: failedCount > 0 && sentCount === 0 ? failures[0]?.error ?? "Campaign failed" : null,
        externalResponse: {
          ...responseState,
          kind: "ai_email_campaign",
          leadIds,
          pitch,
          totalSelected: leadIds.length,
          processedCount: sentCount + failedCount,
          sentCount,
          failedCount,
          completedAt: new Date().toISOString(),
          failures: failures.slice(-20),
          processedLeadIds,
        } as never,
      },
    });
  }
}

export async function processAutomatedCampaign(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return;

  const responseState = (campaign.externalResponse as Record<string, unknown> | null) ?? {};
  const campaignType = responseState.campaignType;
  if (campaignType !== "automated") return;

  const triggerRule = responseState.triggerRule as {
    dateFieldKey: string;
    daysOffset: number;
    timingType: "before" | "on" | "after";
  } | null;
  if (!triggerRule) return;

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const currentYear = today.getFullYear();

  const lastDailyScanDate = typeof responseState.lastDailyScanDate === "string" ? responseState.lastDailyScanDate : "";
  const leadIds = Array.isArray(responseState.leadIds) ? responseState.leadIds.filter((item): item is string => typeof item === "string") : [];
  const processedLeadIds = Array.isArray(responseState.processedLeadIds) ? responseState.processedLeadIds.filter((item): item is string => typeof item === "string") : [];
  const lastSentYears = (responseState.lastSentYears as Record<string, number> | null) ?? {};
  let matchedPendingLeadIds = Array.isArray(responseState.matchedPendingLeadIds) ? responseState.matchedPendingLeadIds.filter((item): item is string => typeof item === "string") : [];
  let sentCount = typeof responseState.sentCount === "number" ? responseState.sentCount : 0;
  let failedCount = typeof responseState.failedCount === "number" ? responseState.failedCount : 0;
  const failures = Array.isArray(responseState.failures) ? responseState.failures : [];

  if (lastDailyScanDate !== todayStr) {
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        email: { not: null },
      },
      select: { id: true, metadata: true },
    });

    const { dateFieldKey, daysOffset, timingType } = triggerRule;
    const newMatches: string[] = [];

    for (const lead of leads) {
      const metadataObj = (lead.metadata as Record<string, unknown> | null) ?? {};
      const dateVal = metadataObj[dateFieldKey];
      if (!dateVal) continue;

      if (shouldSendToday(dateVal, daysOffset, timingType)) {
        if (processedLeadIds.includes(lead.id)) continue;
        if (lastSentYears[lead.id] === currentYear) continue;
        if (matchedPendingLeadIds.includes(lead.id)) continue;

        newMatches.push(lead.id);
      }
    }

    if (newMatches.length > 0) {
      matchedPendingLeadIds = [...matchedPendingLeadIds, ...newMatches];
      responseState.matchedPendingLeadIds = matchedPendingLeadIds;
      logger.info(`Automated campaign ${campaign.id} matched ${newMatches.length} leads today.`);
    }
    responseState.lastDailyScanDate = todayStr;

    await prisma.leadCampaign.update({
      where: { id: campaign.id },
      data: {
        externalResponse: responseState as never,
      },
    });
  }

  if (matchedPendingLeadIds.length === 0) {
    return;
  }

  const user = campaign.createdById
    ? await prisma.user.findUnique({
        where: { id: campaign.createdById },
        include: {
          roles: { include: { role: true } },
          subscriptions: {
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
      })
    : null;

  if (!user) {
    logger.warn(`Owner not found for automated campaign ${campaign.id}`);
    return;
  }

  const activeSubscription = user.subscriptions.find((item) => item.status === "active" || item.status === "trialing");
  const subscriptionPlan = activeSubscription?.planName ?? "base";
  const isSuperAdmin = user.roles.some((entry) => entry.role.name === "super_admin");

  const leadsToSend = await prisma.lead.findMany({
    where: {
      id: { in: matchedPendingLeadIds },
      email: { not: null },
    },
    select: {
      id: true,
      name: true,
      business: true,
      email: true,
      industry: true,
      location: true,
      website: true,
      source: true,
      metadata: true,
    },
  });

  const subjectTemplate = typeof responseState.subjectTemplate === "string" ? responseState.subjectTemplate : "";
  const bodyTemplate = typeof responseState.bodyTemplate === "string" ? responseState.bodyTemplate : "";

  for (const lead of leadsToSend) {
    if (!lead.email) continue;

    if (sentCount > 0 || failedCount > 0) {
      const delay = 5000 + Math.random() * 5000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const mailbox = await selectMailboxForUser(user.id);
      const subject = fillPlaceholders(subjectTemplate, lead);
      const body = fillPlaceholders(bodyTemplate, lead);
      const isHtml = /<\/?[a-z][\s\S]*>/i.test(body);

      await sendEmail({
        userId: user.id,
        subscriptionPlan,
        isSuperAdmin,
        toEmail: lead.email,
        subject,
        body,
        fromEmail: mailbox.fromEmail,
        isHtml,
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: "contacted",
          outreachEnabled: true,
        },
      });

      sentCount += 1;
      processedLeadIds.push(lead.id);
      lastSentYears[lead.id] = currentYear;
      matchedPendingLeadIds = matchedPendingLeadIds.filter((id) => id !== lead.id);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown send error";
      const isQuotaError = errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("limit reached") || errMsg.toLowerCase().includes("no free email mailbox") || errMsg.toLowerCase().includes("quota is available");
      if (isQuotaError) {
        logger.info(`Automated campaign ${campaignId} reached quota limits. Pausing.`);
        break;
      }

      failedCount += 1;
      failures.push({
        leadId: lead.id,
        email: lead.email,
        error: errMsg,
      });
      processedLeadIds.push(lead.id);
      matchedPendingLeadIds = matchedPendingLeadIds.filter((id) => id !== lead.id);
    }

    await prisma.leadCampaign.update({
      where: { id: campaign.id },
      data: {
        externalResponse: {
          ...responseState,
          processedLeadIds,
          lastSentYears,
          matchedPendingLeadIds,
          sentCount,
          failedCount,
          failures: failures.slice(-20),
          processedCount: sentCount + failedCount,
        } as never,
      },
    });
  }
}

export async function createMessageAutomationCampaign(input: {
  userId: string;
  source: LeadSourceType;
  pitch: string;
  leadIds: string[];
  campaignType?: "ai" | "manual" | "automated";
  subjectTemplate?: string;
  bodyTemplate?: string;
  triggerRule?: {
    dateFieldKey: string;
    daysOffset: number;
    timingType: "before" | "on" | "after";
  };
  scheduledAt?: string;
}) {
  const isAutomated = input.campaignType === "automated";
  const isScheduled = !!input.scheduledAt;
  const campaign = await prisma.leadCampaign.create({
    data: {
      source: input.source,
      businessType: "AI Email Automation",
      location: input.source,
      leadCount: input.leadIds.length,
      createdById: input.userId,
      status: isScheduled ? "pending" : (isAutomated ? "processing" : "pending"),
      externalResponse: {
        kind: "ai_email_campaign",
        campaignType: input.campaignType || "ai",
        pitch: input.pitch,
        subjectTemplate: input.subjectTemplate || "",
        bodyTemplate: input.bodyTemplate || "",
        leadIds: input.leadIds,
        totalSelected: input.leadIds.length,
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        queuedAt: new Date().toISOString(),
        triggerRule: input.triggerRule || null,
        scheduledAt: input.scheduledAt || null,
        processedLeadIds: [],
        failures: [],
      } as never,
    },
  });

  if (!isAutomated && !isScheduled) {
    void runMessageAutomationCampaign(campaign.id);
  }
  return campaign;
}

function parseDateUTC(dateVal: string | Date): { year: number; month: number; day: number } | null {
  try {
    if (dateVal instanceof Date) {
      if (isNaN(dateVal.getTime())) return null;
      return {
        year: dateVal.getUTCFullYear(),
        month: dateVal.getUTCMonth() + 1,
        day: dateVal.getUTCDate()
      };
    }

    if (typeof dateVal !== "string") {
      return null;
    }

    const trimmed = dateVal.trim();
    if (!trimmed) return null;

    // Try YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = trimmed.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10);
      const day = parseInt(ymdMatch[3], 10);
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }
      return { year, month, day };
    }

    // Try MM/DD/YYYY or DD/MM/YYYY or MM/DD/YY etc.
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/);
    if (dmyMatch) {
      let first = parseInt(dmyMatch[1], 10);
      let second = parseInt(dmyMatch[2], 10);
      let rawYear = parseInt(dmyMatch[3], 10);
      let year = rawYear;
      if (rawYear < 100) {
        year = rawYear < 50 ? 2000 + rawYear : 1900 + rawYear;
      }

      let month = first;
      let day = second;
      if (first > 12) {
        // First part is day, second is month
        day = first;
        month = second;
      }
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }
      return { year, month, day };
    }

    // Fallback to native Date parsing
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      return null;
    }

    return {
      year: parsed.getUTCFullYear(),
      month: parsed.getUTCMonth() + 1,
      day: parsed.getUTCDate()
    };
  } catch (err) {
    logger.warn(`parseDateUTC: Failed to parse malformed date string: "${String(dateVal)}"`, err);
    return null;
  }
}

function shouldSendToday(dateString: string | unknown, daysOffset: number, timingType: "before" | "on" | "after"): boolean {
  try {
    if (typeof dateString !== "string" && !(dateString instanceof Date)) return false;

    const parsed = parseDateUTC(dateString);
    if (!parsed) return false;

    const today = new Date();
    const todayYear = today.getUTCFullYear();
    const todayMonth = today.getUTCMonth() + 1;
    const todayDay = today.getUTCDate();
    const todayMidnightUTC = Date.UTC(todayYear, todayMonth - 1, todayDay);

    // 1. Strict Event Date check (Checks exact date matching event logic)
    const strictEventUTC = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
    if (isNaN(strictEventUTC.getTime())) return false;

    let strictTargetUTC = new Date(strictEventUTC);
    if (timingType === "before") {
      strictTargetUTC.setUTCDate(strictTargetUTC.getUTCDate() - daysOffset);
    } else if (timingType === "after") {
      strictTargetUTC.setUTCDate(strictTargetUTC.getUTCDate() + daysOffset);
    }

    if (strictTargetUTC.getTime() === todayMidnightUTC) {
      return true;
    }

    // 2. Annualized recurring check (e.g. Birthdays recurring every year)
    const recurringEventUTC = new Date(Date.UTC(todayYear, parsed.month - 1, parsed.day));
    if (isNaN(recurringEventUTC.getTime())) return false;

    let recurringTargetUTC = new Date(recurringEventUTC);
    if (timingType === "before") {
      recurringTargetUTC.setUTCDate(recurringTargetUTC.getUTCDate() - daysOffset);
    } else if (timingType === "after") {
      recurringTargetUTC.setUTCDate(recurringTargetUTC.getUTCDate() + daysOffset);
    }

    if (recurringTargetUTC.getTime() === todayMidnightUTC) {
      return true;
    }

    return false;
  } catch (err) {
    logger.warn(`shouldSendToday: error evaluating campaign date matching rules. Input: ${String(dateString)}`, err);
    return false;
  }
}


export async function processDailyAutomatedCampaigns() {
  await resumeAndProcessCampaigns();
}

const activeCampaignRuns = new Set<string>();

export async function resumeAndProcessCampaigns() {
  const campaigns = await prisma.leadCampaign.findMany({
    where: {
      status: { in: [LeadCampaignStatus.pending, LeadCampaignStatus.processing] },
      businessType: "AI Email Automation",
    },
  });

  for (const campaign of campaigns) {
    if (activeCampaignRuns.has(campaign.id)) {
      continue;
    }

    activeCampaignRuns.add(campaign.id);
    void (async () => {
      try {
        const responseState = (campaign.externalResponse as Record<string, unknown> | null) ?? {};
        const campaignType = responseState.campaignType;

        if (campaignType === "automated") {
          await processAutomatedCampaign(campaign.id);
        } else {
          const scheduledAtStr = responseState.scheduledAt;
          if (typeof scheduledAtStr === "string") {
            const scheduledAt = new Date(scheduledAtStr);
            if (!isNaN(scheduledAt.getTime()) && scheduledAt > new Date()) {
              return;
            }
          }
          await runMessageAutomationCampaign(campaign.id);
        }
      } catch (err) {
        logger.error(`Error processing campaign ${campaign.id} in background:`, err);
      } finally {
        activeCampaignRuns.delete(campaign.id);
      }
    })();
  }
}