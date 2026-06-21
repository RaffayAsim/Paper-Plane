import type { LeadSourceType } from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";

type CachedLeadRecord = {
  campaignId: string | null;
  name: string;
  business: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
  categories: unknown;
  reviewsCount: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  metadata: unknown;
};

function normalizeLeadKey(value: string) {
  return value.trim().toLowerCase();
}

function buildSearchTerms(value: string) {
  const normalized = value.trim().toLowerCase();
  const words = normalized
    .split(/[^a-z0-9]+/i)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);

  return [
    normalized,
    ...words,
    ...words.map((word) => (word.endsWith("s") ? word.slice(0, -1) : `${word}s`)),
  ].filter((term, index, terms) => term && terms.indexOf(term) === index);
}

function metadataText(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  const record = metadata as Record<string, unknown>;
  const categories = Array.isArray(record.categories) ? record.categories : [];

  return categories.filter((category): category is string => typeof category === "string").join(" ");
}

function matchesSearchTerms(candidate: CachedLeadRecord, terms: string[]) {
  const searchableText = [
    candidate.industry,
    candidate.name,
    candidate.business,
    Array.isArray(candidate.categories) ? candidate.categories.join(" ") : null,
    metadataText(candidate.metadata),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return terms.some((term) => searchableText.includes(term));
}

function matchesLocationTerms(candidate: CachedLeadRecord, terms: string[]) {
  if (terms.length === 0) {
    return true;
  }

  const searchableText = [
    candidate.location,
    candidate.address,
    candidate.city,
    candidate.state,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return terms.some((term) => searchableText.includes(term));
}

export function getCachedLeadTarget(leadCount: number) {
  if (leadCount <= 25) {
    return leadCount;
  }

  return Math.max(1, Math.floor(leadCount * 0.4));
}

export async function hydrateCampaignFromLeadCache(input: {
  campaignId: string;
  source: LeadSourceType;
  businessType: string;
  location: string;
  leadCount: number;
  includeUnassignedLeads?: boolean;
}) {
  const desiredCachedCount = Math.min(getCachedLeadTarget(input.leadCount), input.leadCount);
  const fetchLimit = Math.min(Math.max(input.leadCount * 5, 200), 2000);
  const normalizedLocation = input.location.trim();
  const searchTerms = buildSearchTerms(input.businessType);
  const locationTerms = buildSearchTerms(input.location);
  const businessWhere = searchTerms.flatMap((term) => [
    { industry: { contains: term } },
    { name: { contains: term } },
    { business: { contains: term } },
    { categories: { string_contains: term } },
    { metadata: { path: ["categories"], string_contains: term } },
  ]);
  const locationWhere = locationTerms.flatMap((term) => [
    { location: { contains: term } },
    { address: { contains: term } },
    { city: { contains: term } },
    { state: { contains: term } },
  ]);

  const existingCampaignLeads = await prisma.lead.findMany({
    where: { campaignId: input.campaignId },
    select: { name: true },
  });
  const existingNames = new Set(existingCampaignLeads.map((item) => normalizeLeadKey(item.name)));

  const candidates = await prisma.lead.findMany({
    where: {
      source: input.source,
      OR: [
        {
          campaignId: { not: input.campaignId },
          campaign: {
            source: input.source,
            businessType: input.businessType,
            location: input.location,
          },
        },
        ...(input.includeUnassignedLeads
          ? [
              {
                campaignId: null,
                AND: [
                  ...(businessWhere.length > 0 ? [{ OR: businessWhere }] : []),
                  ...(normalizedLocation && locationWhere.length > 0 ? [{ OR: locationWhere }] : []),
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      campaignId: true,
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
    take: fetchLimit,
  });

  const uniqueCandidates: CachedLeadRecord[] = [];
  for (const candidate of candidates) {
    if (
      candidate.campaignId === null &&
      (!matchesSearchTerms(candidate, searchTerms) || !matchesLocationTerms(candidate, locationTerms))
    ) {
      continue;
    }

    const normalizedName = normalizeLeadKey(candidate.name);
    if (existingNames.has(normalizedName)) {
      continue;
    }
    existingNames.add(normalizedName);
    uniqueCandidates.push(candidate);
  }

  const selected = uniqueCandidates.slice(0, desiredCachedCount);

  if (selected.length > 0) {
    await prisma.lead.createMany({
      data: selected.map((lead) => ({
        campaignId: input.campaignId,
        source: input.source,
        name: lead.name,
        business: lead.business,
        email: lead.email,
        phone: lead.phone,
        website: lead.website,
        industry: lead.industry,
        location: lead.location,
        categories: lead.categories as never,
        reviewsCount: lead.reviewsCount,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        status: "new",
        outreachEnabled: false,
        metadata: lead.metadata as never,
      })),
    });
  }

  const reusedCount = selected.length;
  const scrapeTarget = Math.max(0, input.leadCount - reusedCount);

  return {
    availableCachedCount: uniqueCandidates.length,
    desiredCachedCount,
    reusedCount,
    scrapeTarget,
  };
}
