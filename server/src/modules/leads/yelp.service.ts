import { randomUUID } from "node:crypto";
import { config } from "../../lib/config.js";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { findBusinessEmailFromWebsite } from "./business-email.service.js";
import { hydrateCampaignFromLeadCache } from "./lead-cache.js";
import { scrapeYelpPlaces, type YelpLead } from "./yelp.scraper.js";

const ENABLE_YELP_FRESH_SCRAPING = true;
const ENABLE_YELP_LEAD_ENRICHMENT = true;
const ENABLE_YELP_CACHE = config.YELP_USE_CACHE;
const ENRICHMENT_SEARCH_RESULT_LIMIT = 12;

const ENRICHMENT_BLOCKED_HOSTS = [
  "yelp.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tripadvisor.com",
  "opentable.com",
  "grubhub.com",
  "doordash.com",
  "ubereats.com",
  "mapquest.com",
  "yellowpages.com",
];

type YelpLeadEnrichmentTarget = {
  id: string;
  name: string;
  business: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  location: string | null;
  metadata: unknown;
};

type YelpLeadEnrichmentResult = {
  website: string | null;
  phone: string | null;
  searchedUrls: string[];
};

type YelpJobCreateResponse = {
  success: boolean;
  job_id: string;
  status: "processing";
  message: string;
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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#64;/g, "@")
    .replace(/&#x40;/gi, "@")
    .replace(/&#46;/g, ".")
    .replace(/&#x2e;/gi, ".")
    .replace(/&commat;/gi, "@")
    .replace(/&period;/gi, ".")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'");
}

function stripCommonSubdomains(hostname: string) {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function isBlockedEnrichmentHost(hostname: string) {
  const normalized = stripCommonSubdomains(hostname);
  return ENRICHMENT_BLOCKED_HOSTS.some((host) => normalized === host || normalized.endsWith(`.${host}`));
}

function normalizeWebsiteUrl(rawUrl: string | null | undefined) {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function extractDuckDuckGoResultUrls(html: string) {
  const urls = new Set<string>();

  for (const match of html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"/gi)) {
    const href = decodeHtmlEntities(match[1] ?? "");
    if (!href) continue;

    try {
      const url = new URL(href);
      const uddg = url.searchParams.get("uddg");
      const target = new URL(uddg ? decodeURIComponent(uddg) : href);
      if (!isBlockedEnrichmentHost(target.hostname)) {
        target.hash = "";
        urls.add(target.toString());
      }
    } catch {
      // Ignore malformed search result links.
    }
  }

  return [...urls].slice(0, ENRICHMENT_SEARCH_RESULT_LIMIT);
}

function extractPhone(text: string) {
  const decoded = decodeHtmlEntities(text);
  const telMatch = decoded.match(/tel:\s*([+()0-9.\-\s]{7,24})/i);
  const phoneMatch = decoded.match(/(?:\+?1[\s.-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[\s.-]?\d{3}[\s.-]?\d{4}/);
  const rawPhone = telMatch?.[1] ?? phoneMatch?.[0] ?? null;

  return rawPhone?.replace(/\s+/g, " ").trim() ?? null;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().includes("text/html")) return null;

  return response.text();
}

function buildEnrichmentSearchQuery(lead: YelpLeadEnrichmentTarget) {
  const location = [lead.address, lead.city, lead.state].filter(Boolean).join(" ") || lead.location || "";
  return `${lead.business || lead.name} ${location} official website phone`;
}

async function discoverYelpLeadWebsiteAndPhone(lead: YelpLeadEnrichmentTarget): Promise<YelpLeadEnrichmentResult> {
  const query = buildEnrichmentSearchQuery(lead);
  logger.info("[yelp] enrichment search started", {
    leadId: lead.id,
    leadName: lead.name,
    query,
  });
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const searchHtml = await fetchHtml(searchUrl);
  const searchedUrls = [searchUrl];
  if (!searchHtml) {
    logger.warn("[yelp] enrichment search returned no HTML", {
      leadId: lead.id,
      searchUrl,
    });
    return { website: null, phone: null, searchedUrls };
  }

  const resultUrls = extractDuckDuckGoResultUrls(searchHtml);
  searchedUrls.push(...resultUrls);

  let discoveredPhone = extractPhone(searchHtml);
  for (const resultUrl of resultUrls) {
    const normalizedWebsite = normalizeWebsiteUrl(resultUrl);
    if (!normalizedWebsite) continue;

    try {
      const html = await fetchHtml(normalizedWebsite);
      if (html && !discoveredPhone) {
        discoveredPhone = extractPhone(html);
      }

      return {
        website: normalizedWebsite,
        phone: discoveredPhone,
        searchedUrls,
      };
    } catch {
      // Try the next result.
    }
  }

  logger.info("[yelp] enrichment search finished without direct website match", {
    leadId: lead.id,
    leadName: lead.name,
    phoneFound: Boolean(discoveredPhone),
    searchedCount: searchedUrls.length,
  });
  return { website: null, phone: discoveredPhone, searchedUrls };
}

async function enrichYelpCampaignLeads(campaignId: string) {
  if (!ENABLE_YELP_LEAD_ENRICHMENT) {
    logger.info("[yelp] lead enrichment disabled", { campaignId });
    return { processed: 0, updated: 0, emailUpdated: 0, websiteUpdated: 0, phoneUpdated: 0 };
  }

  const leads = await prisma.lead.findMany({
    where: {
      campaignId,
      source: "yelp",
      OR: [{ email: null }, { email: "" }, { website: null }, { website: "" }, { phone: null }, { phone: "" }],
    },
    select: {
      id: true,
      name: true,
      business: true,
      email: true,
      phone: true,
      website: true,
      address: true,
      city: true,
      state: true,
      location: true,
      metadata: true,
    },
  });

  let processed = 0;
  let updated = 0;
  let emailUpdated = 0;
  let websiteUpdated = 0;
  let phoneUpdated = 0;

  logger.info("[yelp] lead enrichment started", {
    campaignId,
    leadsToProcess: leads.length,
  });

  for (const lead of leads) {
    processed += 1;
    const previousMetadata =
      lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
        ? (lead.metadata as Record<string, unknown>)
        : {};

    const discovery = await discoverYelpLeadWebsiteAndPhone(lead);
    const website = lead.website || discovery.website;
    const emailDiscovery = !lead.email && website ? await findBusinessEmailFromWebsite(website) : null;
    const updateData: Record<string, unknown> = {
      metadata: {
        ...previousMetadata,
        enrichmentSearchedUrls: discovery.searchedUrls,
        enrichmentWebsiteUrl: discovery.website,
        enrichmentPhone: discovery.phone,
        ...(emailDiscovery
          ? {
              emailSourceUrl: emailDiscovery.sourceUrl,
              emailScannedUrls: emailDiscovery.scannedUrls,
            }
          : {}),
      },
    };

    if (!lead.website && discovery.website) {
      updateData.website = discovery.website;
      websiteUpdated += 1;
    }
    if (!lead.phone && discovery.phone) {
      updateData.phone = discovery.phone;
      phoneUpdated += 1;
    }
    if (!lead.email && emailDiscovery?.email) {
      updateData.email = emailDiscovery.email;
      emailUpdated += 1;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: updateData as never,
    });

    updated += Object.keys(updateData).some((key) => key !== "metadata") ? 1 : 0;

    logger.info("[yelp] lead enrichment progress", {
      campaignId,
      leadId: lead.id,
      leadName: lead.name,
      processed,
      total: leads.length,
      websiteFound: Boolean(discovery.website),
      phoneFound: Boolean(discovery.phone),
      emailFound: Boolean(emailDiscovery?.email),
      websiteUpdated,
      phoneUpdated,
      emailUpdated,
    });
  }

  logger.info("[yelp] lead enrichment completed", {
    campaignId,
    processed,
    updated,
    emailUpdated,
    websiteUpdated,
    phoneUpdated,
  });
  return { processed, updated, emailUpdated, websiteUpdated, phoneUpdated };
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

  logger.info("[yelp] campaign progress updated", {
    campaignId,
    ...updates,
  });
}

async function storeYelpLead(campaignId: string, lead: YelpLead) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentLead = await prisma.lead.findFirst({
    where: {
      source: "yelp",
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
          source: "yelp",
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

  await prisma.lead.create({
    data: {
      campaignId,
      source: "yelp",
      name: lead.name,
      business: lead.name,
      email: null,
      phone: lead.phone_number || null,
      website: lead.website || null,
      industry: lead.categories[0] || null,
      location: lead.address || lead.neighborhood || null,
      categories: lead.categories,
      reviewsCount: lead.reviews_count ?? null,
      address: lead.address || null,
      city: null,
      state: null,
      status: "new",
      outreachEnabled: false,
      metadata: {
        neighborhood: lead.neighborhood ?? null,
        categories: lead.categories,
        reviewsCount: lead.reviews_count ?? null,
        reviewsAverage: lead.reviews_average ?? null,
        snippet: lead.snippet ?? null,
        detailUrl: lead.detail_url ?? null,
        businessStatus: lead.business_status ?? null,
      },
    },
  });
}

async function runYelpCampaign(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    logger.warn("[yelp] campaign worker started for missing campaign", { campaignId });
    return;
  }

  try {
    logger.info("[yelp] campaign worker started", {
      campaignId,
      businessType: campaign.businessType,
      location: campaign.location,
      leadCount: campaign.leadCount,
      cacheEnabled: ENABLE_YELP_CACHE,
      freshScrapingEnabled: ENABLE_YELP_FRESH_SCRAPING,
      enrichmentEnabled: ENABLE_YELP_LEAD_ENRICHMENT,
    });

    const cachePlan = ENABLE_YELP_CACHE
      ? await hydrateCampaignFromLeadCache({
          campaignId,
          source: "yelp",
          businessType: campaign.businessType,
          location: campaign.location,
          leadCount: campaign.leadCount,
          includeUnassignedLeads: true,
        })
      : {
          availableCachedCount: 0,
          desiredCachedCount: 0,
          reusedCount: 0,
          scrapeTarget: campaign.leadCount,
        };

    logger.info("Lead cache plan", {
      campaignId,
      source: "yelp",
      query: campaign.businessType,
      location: campaign.location,
      requested: campaign.leadCount,
      cacheEnabled: ENABLE_YELP_CACHE,
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

    if (ENABLE_YELP_FRESH_SCRAPING && cachePlan.scrapeTarget > 0) {
      logger.info("[yelp] starting fresh scraping", {
        campaignId,
        query: campaign.businessType,
        location: campaign.location,
        scrapeTarget: cachePlan.scrapeTarget,
      });
      processed = await scrapeYelpPlaces({
        query: campaign.businessType,
        location: campaign.location,
        total: cachePlan.scrapeTarget,
        onLeadFound: async (lead) => {
          await storeYelpLead(campaignId, lead);
          foundCount = await prisma.lead.count({ where: { campaignId } });
          await updateCampaignProgress(campaignId, {
            status: "processing",
            found_count: foundCount,
            cached_count: cachePlan.reusedCount,
            fresh_target: cachePlan.scrapeTarget,
          });

          logger.info("[yelp] scraper lead stored", {
            campaignId,
            leadName: lead.name,
            foundCount,
            scrapeTarget: cachePlan.scrapeTarget,
          });
        },
      });
    } else {
      logger.info("[yelp] fresh scraping skipped", {
        campaignId,
        freshScrapingEnabled: ENABLE_YELP_FRESH_SCRAPING,
        scrapeTarget: cachePlan.scrapeTarget,
        reason: !ENABLE_YELP_FRESH_SCRAPING ? "fresh scraping disabled" : "no scrape target",
      });
    }

    await updateCampaignProgress(campaignId, {
      status: "processing",
      found_count: foundCount,
      cached_count: cachePlan.reusedCount,
      fresh_target: cachePlan.scrapeTarget,
      enrichment_enabled: ENABLE_YELP_LEAD_ENRICHMENT,
      enrichment_status: ENABLE_YELP_LEAD_ENRICHMENT ? "processing" : "disabled",
    });

    const enrichmentResult = await enrichYelpCampaignLeads(campaignId);
    const finalCount = await prisma.lead.count({ where: { campaignId } });

    logger.info("Lead cache result", {
      campaignId,
      source: "yelp",
      requested: campaign.leadCount,
      cacheEnabled: ENABLE_YELP_CACHE,
      reused: cachePlan.reusedCount,
      scrapedRequested: cachePlan.scrapeTarget,
      scraperProcessed: processed,
      enrichmentProcessed: enrichmentResult.processed,
      enrichmentUpdated: enrichmentResult.updated,
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
          cache_enabled: ENABLE_YELP_CACHE,
          fresh_scraping_enabled: ENABLE_YELP_FRESH_SCRAPING,
          enrichment_enabled: ENABLE_YELP_LEAD_ENRICHMENT,
          enrichment_status: "completed",
          enrichment_processed: enrichmentResult.processed,
          enrichment_updated: enrichmentResult.updated,
          enrichment_email_updated: enrichmentResult.emailUpdated,
          enrichment_website_updated: enrichmentResult.websiteUpdated,
          enrichment_phone_updated: enrichmentResult.phoneUpdated,
          cache_available: cachePlan.availableCachedCount,
          query: campaign.businessType,
          location: campaign.location,
        } as never,
      },
    });
  } catch (error) {
    const errorMessage = toCampaignErrorMessage(error, "Yelp scraping failed");

    logger.error("[yelp] campaign worker failed", {
      campaignId,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
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

export async function createYelpJob(input: {
  campaignId: string;
  businessType: string;
  location: string;
  leadCount: number;
}) {
  const jobId = randomUUID();

  logger.info("[yelp] creating campaign job", {
    campaignId: input.campaignId,
    jobId,
    businessType: input.businessType,
    location: input.location,
    leadCount: input.leadCount,
    cacheEnabled: ENABLE_YELP_CACHE,
    freshScrapingEnabled: ENABLE_YELP_FRESH_SCRAPING,
    enrichmentEnabled: ENABLE_YELP_LEAD_ENRICHMENT,
  });

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
        cache_enabled: ENABLE_YELP_CACHE,
        fresh_scraping_enabled: ENABLE_YELP_FRESH_SCRAPING,
        enrichment_enabled: ENABLE_YELP_LEAD_ENRICHMENT,
      } as never,
    },
  });

  setTimeout(() => {
    logger.info("[yelp] background worker scheduled", {
      campaignId: input.campaignId,
      jobId,
    });
    void runYelpCampaign(input.campaignId);
  }, 0);

  return {
    success: true,
    job_id: jobId,
    status: "processing",
    message: ENABLE_YELP_FRESH_SCRAPING || !ENABLE_YELP_CACHE
      ? "Yelp scraping started in background"
      : "Yelp cache import started in background",
  } satisfies YelpJobCreateResponse;
}

export async function syncYelpCampaign(campaignId: string) {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
    include: {
      leads: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.source !== "yelp") {
    throw new Error("This sync endpoint only supports yelp campaigns");
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
