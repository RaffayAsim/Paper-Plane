import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { findBusinessEmailFromWebsite } from "./business-email.service.js";
import { hydrateCampaignFromLeadCache } from "./lead-cache.js";
import { scrapeYellowPagesPlaces, type YellowPagesLead } from "./yellow-pages.scraper.js";

type YellowPagesJobCreateResponse = {
  success: boolean;
  job_id: string;
  status: "processing";
  message: string;
};

const MAX_CAMPAIGN_ERROR_MESSAGE_LENGTH = 500;

function normalizeComparable(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function isSameYellowPagesBusiness(
  lead: YellowPagesLead,
  record: {
    name: string | null;
    address: string | null;
    phone: string | null;
    website: string | null;
    location: string | null;
    business: string | null;
  },
) {
  const leadName = normalizeComparable(lead.name);
  const recordName = normalizeComparable(record.name || record.business || "");
  if (!leadName || !recordName || leadName !== recordName) {
    return false;
  }

  const leadWebsite = normalizeComparable(lead.website);
  const recordWebsite = normalizeComparable(record.website);
  if (leadWebsite && recordWebsite && leadWebsite === recordWebsite) {
    return true;
  }

  const leadPhone = normalizeComparable(lead.phone_number);
  const recordPhone = normalizeComparable(record.phone);
  if (leadPhone && recordPhone && leadPhone === recordPhone) {
    return true;
  }

  const leadAddress = normalizeComparable(lead.address);
  const recordAddress = normalizeComparable(record.address || record.location);
  if (leadAddress && recordAddress && leadAddress === recordAddress) {
    return true;
  }

  // Only fall back to name-only matching when we have no other identifying fields.
  return !leadWebsite && !recordWebsite && !leadPhone && !recordPhone && !leadAddress && !recordAddress;
}

function toCampaignStatus(status: "processing" | "completed" | "failed") {
  return status;
}

function toCampaignErrorMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : fallback;
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > MAX_CAMPAIGN_ERROR_MESSAGE_LENGTH
    ? `${normalized.slice(0, MAX_CAMPAIGN_ERROR_MESSAGE_LENGTH - 3)}...`
    : normalized;
}

async function updateCampaignProgress(campaignId: string, updates: Record<string, unknown>) {
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
  const previous = (campaign?.externalResponse as Record<string, unknown> | null) ?? {};

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: {
      externalResponse: {
        ...previous,
        ...updates,
      } as never,
    },
  });
}

async function storeYellowPagesLead(campaignId: string, lead: YellowPagesLead) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentLeads = await prisma.lead.findMany({
    where: {
      source: "yellow_pages",
      name: lead.name,
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      name: true,
      business: true,
      email: true,
      phone: true,
      website: true,
      industry: true,
      location: true,
      categories: true,
      reviewsCount: true,
      address: true,
      city: true,
      state: true,
      metadata: true,
    },
  });
  const recentLead = recentLeads.find((entry) => isSameYellowPagesBusiness(lead, entry)) ?? null;

  if (recentLead) {
    const existingCampaignLeads = await prisma.lead.findMany({
      where: {
        campaignId,
        name: lead.name,
      },
      select: {
        name: true,
        business: true,
        phone: true,
        website: true,
        address: true,
        location: true,
      },
    });
    const existingCampaignLead = existingCampaignLeads.find((entry) => isSameYellowPagesBusiness(lead, entry));

    if (!existingCampaignLead) {
      await prisma.lead.create({
        data: {
          campaignId,
          source: "yellow_pages",
          name: recentLead.name,
          business: recentLead.business,
          email: recentLead.email,
          phone: recentLead.phone,
          website: recentLead.website,
          industry: recentLead.industry,
          location: recentLead.location,
          categories: recentLead.categories ?? undefined,
          reviewsCount: recentLead.reviewsCount,
          address: recentLead.address,
          city: recentLead.city,
          state: recentLead.state,
          status: "new",
          outreachEnabled: false,
          metadata: recentLead.metadata ?? {},
        },
      });

      return true;
    }

    return false;
  }

  const existingCampaignLeads = await prisma.lead.findMany({
    where: {
      campaignId,
      name: lead.name,
    },
    select: {
      name: true,
      business: true,
      phone: true,
      website: true,
      address: true,
      location: true,
    },
  });
  const existing = existingCampaignLeads.find((entry) => isSameYellowPagesBusiness(lead, entry));

  if (existing) {
    return false;
  }

  const emailDiscovery = await findBusinessEmailFromWebsite(lead.website);

  await prisma.lead.create({
    data: {
      campaignId,
      source: "yellow_pages",
      name: lead.name,
      business: lead.name,
      email: emailDiscovery.email,
      phone: lead.phone_number || null,
      website: lead.website || null,
      industry: lead.categories[0] || null,
      location: lead.address || null,
      categories: lead.categories,
      reviewsCount: lead.reviews_count ?? null,
      address: lead.address || null,
      city: null,
      state: null,
      status: "new",
      outreachEnabled: false,
      metadata: {
        categories: lead.categories,
        reviewsCount: lead.reviews_count ?? null,
        reviewsAverage: lead.reviews_average ?? null,
        snippet: lead.snippet ?? null,
        detailUrl: lead.detail_url ?? null,
        businessStatus: lead.business_status ?? null,
        emailSourceUrl: emailDiscovery.sourceUrl,
        emailScannedUrls: emailDiscovery.scannedUrls,
      },
    },
  });

  return true;
}

async function runYellowPagesCampaign(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    return;
  }

  try {
    const cachePlan = await hydrateCampaignFromLeadCache({
      campaignId,
      source: "yellow_pages",
      businessType: campaign.businessType,
      location: campaign.location,
      leadCount: campaign.leadCount,
    });

    logger.info("Lead cache plan", {
      campaignId,
      source: "yellow_pages",
      query: campaign.businessType,
      location: campaign.location,
      requested: campaign.leadCount,
      cachedAvailable: cachePlan.availableCachedCount,
      cachedTarget: cachePlan.desiredCachedCount,
      reused: cachePlan.reusedCount,
      freshTarget: cachePlan.scrapeTarget,
    });

    let foundCount = cachePlan.reusedCount;

    await updateCampaignProgress(campaignId, {
      status: "processing",
      found_count: foundCount,
      cached_count: cachePlan.reusedCount,
      fresh_target: cachePlan.scrapeTarget,
      cache_available: cachePlan.availableCachedCount,
    });

    let scrapedCount = 0;
    let storedCount = cachePlan.reusedCount;

    if (cachePlan.scrapeTarget > 0) {
      scrapedCount = await scrapeYellowPagesPlaces({
        query: campaign.businessType,
        location: campaign.location,
        total: cachePlan.scrapeTarget,
        onLeadFound: async (lead) => {
          const inserted = await storeYellowPagesLead(campaignId, lead);
          if (!inserted) {
            logger.info("[yellow-pages] skipped duplicate lead", {
              campaignId,
              leadName: lead.name,
              address: lead.address,
              phone: lead.phone_number,
              website: lead.website,
            });
          }

          foundCount = await prisma.lead.count({ where: { campaignId } });
          storedCount = foundCount;
          await updateCampaignProgress(campaignId, {
            status: "processing",
            found_count: foundCount,
            cached_count: cachePlan.reusedCount,
            fresh_target: cachePlan.scrapeTarget,
          });
        },
      });
    }

    const finalCount = await prisma.lead.count({ where: { campaignId } });

    logger.info("Lead cache result", {
      campaignId,
      source: "yellow_pages",
      requested: campaign.leadCount,
      reused: cachePlan.reusedCount,
      scrapedRequested: cachePlan.scrapeTarget,
      scraperProcessed: scrapedCount,
      storedCount,
      finalCount,
    });

    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: {
        status: toCampaignStatus("completed"),
        errorMessage: null,
        externalResponse: {
          job_id: (campaign.externalResponse as { job_id?: string } | null)?.job_id ?? randomUUID(),
          status: "completed",
          found_count: finalCount,
          total_requested: campaign.leadCount,
          processed_count: scrapedCount,
          stored_count: storedCount,
          cached_count: cachePlan.reusedCount,
          fresh_target: cachePlan.scrapeTarget,
          cache_available: cachePlan.availableCachedCount,
          query: campaign.businessType,
          location: campaign.location,
        } as never,
      },
    });
  } catch (error) {
    const errorMessage = toCampaignErrorMessage(error, "Yellow Pages scraping failed");

    await prisma.leadCampaign.update({
      where: { id: campaignId },
      data: {
        status: toCampaignStatus("failed"),
        errorMessage,
        externalResponse: {
          ...(((campaign.externalResponse as Record<string, unknown> | null) ?? {})),
          status: "failed",
        } as never,
      },
    });
  }
}

export async function createYellowPagesJob(input: {
  campaignId: string;
  businessType: string;
  location: string;
  leadCount: number;
}) {
  const jobId = randomUUID();

  await prisma.leadCampaign.update({
    where: { id: input.campaignId },
    data: {
      status: "processing",
      externalResponse: {
        job_id: jobId,
        status: "processing",
        query: input.businessType,
        location: input.location,
        total_requested: input.leadCount,
        found_count: 0,
      } as never,
    },
  });

  setTimeout(() => {
    void runYellowPagesCampaign(input.campaignId);
  }, 0);

  return {
    success: true,
    job_id: jobId,
    status: "processing",
    message: "Yellow Pages scraping started in background",
  } satisfies YellowPagesJobCreateResponse;
}

export async function syncYellowPagesCampaign(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
    include: {
      leads: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.source !== "yellow_pages") {
    throw new Error("This sync endpoint only supports yellow_pages campaigns");
  }

  const foundCount = campaign.leads.length;

  return {
    campaignStatus: campaign.status,
    imported: foundCount,
    foundCount,
    leads: campaign.leads,
    externalResponse: campaign.externalResponse,
  };
}
