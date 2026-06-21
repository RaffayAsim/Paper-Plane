import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import { hydrateCampaignFromLeadCache } from "./lead-cache.js";
import { findBusinessEmailFromWebsite } from "./business-email.service.js";
import { scrapeGoogleMapsPlaces, type GoogleMapsLead } from "./google-maps.scraper.js";

type GoogleMapsJobCreateResponse = {
  success: boolean;
  job_id: string;
  status: "processing";
  message: string;
  use_proxy: boolean;
};

const MAX_CAMPAIGN_ERROR_MESSAGE_LENGTH = 500;

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

async function storeGoogleMapsLead(campaignId: string, lead: GoogleMapsLead) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentLead = await prisma.lead.findFirst({
    where: {
      source: "google_maps",
      name: lead.name,
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
  });

  if (recentLead) {
    const existingCampaignLead = await prisma.lead.findFirst({
      where: {
        campaignId,
        name: lead.name,
      },
    });

    if (!existingCampaignLead) {
      await prisma.lead.create({
        data: {
          campaignId,
          source: "google_maps",
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
    }

    return;
  }

  const existing = await prisma.lead.findFirst({
    where: {
      campaignId,
      name: lead.name,
    },
  });

  if (existing) {
    return;
  }

  const emailDiscovery = await findBusinessEmailFromWebsite(lead.website);

  await prisma.lead.create({
    data: {
      campaignId,
      source: "google_maps",
      name: lead.name,
      business: lead.name,
      email: emailDiscovery.email,
      phone: lead.phone_number || null,
      website: lead.website || null,
      industry: lead.place_type || null,
      location: lead.address || null,
      categories: lead.place_type ? [lead.place_type] : [],
      reviewsCount: lead.reviews_count ?? null,
      address: lead.address || null,
      city: null,
      state: null,
      status: "new",
      outreachEnabled: false,
      metadata: {
        reviewsCount: lead.reviews_count ?? null,
        reviewsAverage: lead.reviews_average ?? null,
        storeShopping: lead.store_shopping ?? null,
        inStorePickup: lead.in_store_pickup ?? null,
        storeDelivery: lead.store_delivery ?? null,
        opensAt: lead.opens_at ?? null,
        introduction: lead.introduction ?? null,
        emailSourceUrl: emailDiscovery.sourceUrl,
        emailScannedUrls: emailDiscovery.scannedUrls,
      },
    },
  });
}

async function runGoogleMapsCampaign(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    return;
  }

  try {
    const cachePlan = await hydrateCampaignFromLeadCache({
      campaignId,
      source: "google_maps",
      businessType: campaign.businessType,
      location: campaign.location,
      leadCount: campaign.leadCount,
    });

    logger.info("Lead cache plan", {
      campaignId,
      source: "google_maps",
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

    let processed = 0;

    if (cachePlan.scrapeTarget > 0) {
      processed = await scrapeGoogleMapsPlaces({
        query: campaign.businessType,
        location: campaign.location,
        total: cachePlan.scrapeTarget,
        useProxy: config.GOOGLE_MAPS_USE_PROXY ?? false,
        headless: config.GOOGLE_MAPS_HEADLESS ?? true,
        onLeadFound: async (lead) => {
          await storeGoogleMapsLead(campaignId, lead);
          foundCount = await prisma.lead.count({ where: { campaignId } });
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
      source: "google_maps",
      requested: campaign.leadCount,
      reused: cachePlan.reusedCount,
      scrapedRequested: cachePlan.scrapeTarget,
      scraperProcessed: processed,
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
          processed_count: processed,
          cached_count: cachePlan.reusedCount,
          fresh_target: cachePlan.scrapeTarget,
          cache_available: cachePlan.availableCachedCount,
          query: campaign.businessType,
          location: campaign.location,
          use_proxy: config.GOOGLE_MAPS_USE_PROXY ?? false,
        } as never,
      },
    });
  } catch (error) {
    const errorMessage = toCampaignErrorMessage(error, "Google Maps scraping failed");

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

export async function createGoogleMapsJob(input: {
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
        use_proxy: config.GOOGLE_MAPS_USE_PROXY ?? false,
      } as never,
    },
  });

  setTimeout(() => {
    void runGoogleMapsCampaign(input.campaignId);
  }, 0);

  return {
    success: true,
    job_id: jobId,
    status: "processing",
    message: "Google Maps scraping started in background",
    use_proxy: config.GOOGLE_MAPS_USE_PROXY ?? false,
  } satisfies GoogleMapsJobCreateResponse;
}

export async function syncGoogleMapsCampaign(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
    include: {
      leads: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.source !== "google_maps") {
    throw new Error("This sync endpoint only supports google_maps campaigns");
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
