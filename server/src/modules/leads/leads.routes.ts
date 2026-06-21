import { LeadSourceType, LeadStatus, EmailDirection } from "../../generated/prisma/index.js";
import { createHash } from "node:crypto";
import { Router } from "express";
import { Prisma } from "../../generated/prisma/index.js";
import { z } from "zod";
import { getUserAiBrandProfile } from "../../lib/ai-brand-profile.js";
import { generateAiCampaignBrief } from "../../lib/ai-provider.js";
import { prisma } from "../../lib/prisma.js";
import { getLeadCreditSummary } from "../../lib/usage-credits.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePlan } from "../../middleware/plan.js";
import { writeAuditLog } from "../../utils/audit.js";
import { createGoogleMapsJob, syncGoogleMapsCampaign } from "./google-maps.service.js";
import { reEnrichMissingLeadEmailsForCampaign } from "./business-email.service.js";
import { createMessageAutomationCampaign } from "./message-automation.service.js";
import { createYelpJob, syncYelpCampaign } from "./yelp.service.js";
import { createYellowPagesJob, syncYellowPagesCampaign } from "./yellow-pages.service.js";

const router = Router();

const leadQuerySchema = z.object({
  search: z.string().optional(),
  source: z.nativeEnum(LeadSourceType).optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  campaignId: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  minInterestScore: z.coerce.number().int().min(0).max(10).optional(),
  maxInterestScore: z.coerce.number().int().min(0).max(10).optional(),
  minEmailCount: z.coerce.number().int().min(0).optional(),
  maxEmailCount: z.coerce.number().int().min(0).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100000).default(25),
  ids: z.string().optional(),
  engagedOnly: z.string().optional(),
});

const leadExportQuerySchema = z.object({
  search: z.string().optional(),
  source: z.nativeEnum(LeadSourceType).optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  campaignId: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  minInterestScore: z.coerce.number().int().min(0).max(10).optional(),
  maxInterestScore: z.coerce.number().int().min(0).max(10).optional(),
  minEmailCount: z.coerce.number().int().min(0).optional(),
  maxEmailCount: z.coerce.number().int().min(0).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  format: z.enum(["csv", "json"]).default("csv"),
  engagedOnly: z.string().optional(),
});

const campaignIdParamsSchema = z.object({
  id: z.string().min(1),
});

const geocodeLocationsSchema = z.object({
  locations: z.array(z.string().trim().min(1).max(300)).min(1).max(100),
});

const geocodeCache = new Map<string, { latitude: number; longitude: number }>();
const GEOCODE_SETTING_KEY_PREFIX = "geocode.location.";

router.use(requireAuth);

function buildLeadWhere(input: {
  userId?: string;
  isSuperAdmin: boolean;
  source?: LeadSourceType;
  status?: LeadStatus;
  search?: string;
  campaignId?: string;
  industry?: string;
  minInterestScore?: number;
  maxInterestScore?: number;
  dateFrom?: Date;
  dateTo?: Date;
  ids?: string;
  engagedOnly?: string;
  respondedEmails?: string[];
}) {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (input.dateFrom) {
    createdAt.gte = input.dateFrom;
  }
  if (input.dateTo) {
    const inclusiveDateTo = new Date(input.dateTo);
    inclusiveDateTo.setHours(23, 59, 59, 999);
    createdAt.lte = inclusiveDateTo;
  }

  return {
    ...(!input.isSuperAdmin
      ? {
        campaign: {
          createdById: input.userId,
        },
      }
      : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.campaignId ? { campaignId: input.campaignId } : {}),
    ...(input.industry ? { industry: { contains: input.industry } } : {}),
    ...(input.minInterestScore != null || input.maxInterestScore != null
      ? {
        interestScore: {
          ...(input.minInterestScore != null ? { gte: input.minInterestScore } : {}),
          ...(input.maxInterestScore != null ? { lte: input.maxInterestScore } : {}),
        },
      }
      : {}),
    ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
    ...(input.ids ? { id: { in: input.ids.split(",").map(id => id.trim()).filter(Boolean) } } : {}),
    ...(input.search
      ? {
        OR: [
          { name: { contains: input.search } },
          { business: { contains: input.search } },
          { email: { contains: input.search } },
          { location: { contains: input.search } },
        ],
      }
      : {}),
    ...(input.engagedOnly === "true"
      ? {
          OR: [
            { email: { in: input.respondedEmails || [] } },
            { status: { in: [LeadStatus.qualified, LeadStatus.converted] } },
          ],
        }
      : {}),
  };
}

function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const serialized =
    typeof value === "string"
      ? value
      : value instanceof Date
        ? value.toISOString()
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);

  return `"${serialized.replace(/"/g, "\"\"")}"`;
}

function buildLeadCsv(items: Array<Record<string, unknown>>) {
  if (items.length === 0) {
    return "id,name,business,email,phone,website,industry,location,categories,reviewsCount,address,city,state,status,outreachEnabled,source,createdAt,updatedAt";
  }

  const headers = Object.keys(items[0]);
  const rows = items.map((item) => headers.map((header) => escapeCsvCell(item[header])).join(","));
  return [headers.join(","), ...rows].join("\n");
}

async function geocodeLocation(location: string) {
  const cacheKey = location.trim().toLowerCase();
  if (!cacheKey) {
    return null;
  }

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  try {
    const photonQuery = new URLSearchParams({
      q: location,
      limit: "1",
    });
    const photonResponse = await fetch(`https://photon.komoot.io/api/?${photonQuery.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "LeadGen/1.0 (+https://leadgen.local)",
      },
    });

    if (photonResponse.ok) {
      const photonPayload = (await photonResponse.json()) as {
        features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
      };

      const coordinates = photonPayload.features?.[0]?.geometry?.coordinates;
      const longitude = coordinates?.[0];
      const latitude = coordinates?.[1];

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        const parsed = { latitude: Number(latitude), longitude: Number(longitude) };
        geocodeCache.set(cacheKey, parsed);
        return parsed;
      }
    }

    const nominatimQuery = new URLSearchParams({
      q: location,
      format: "json",
      limit: "1",
      addressdetails: "1",
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${nominatimQuery.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "LeadGen/1.0 (+https://leadgen.local)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const first = results[0];
    const latitude = first?.lat ? Number.parseFloat(first.lat) : Number.NaN;
    const longitude = first?.lon ? Number.parseFloat(first.lon) : Number.NaN;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    const parsed = { latitude, longitude };
    geocodeCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function getPersistentGeocodeKey(normalizedLocation: string) {
  const hash = createHash("sha256").update(normalizedLocation).digest("hex");
  return `${GEOCODE_SETTING_KEY_PREFIX}${hash}`;
}

function parsePersistedGeocode(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const latitudeRaw = record.latitude;
  const longitudeRaw = record.longitude;

  const latitude =
    typeof latitudeRaw === "number"
      ? latitudeRaw
      : typeof latitudeRaw === "string"
        ? Number.parseFloat(latitudeRaw)
        : Number.NaN;
  const longitude =
    typeof longitudeRaw === "number"
      ? longitudeRaw
      : typeof longitudeRaw === "string"
        ? Number.parseFloat(longitudeRaw)
        : Number.NaN;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

router.get(
  "/credits",
  asyncHandler(async (req, res) => {
    const summary = await getLeadCreditSummary({
      userId: req.auth!.userId,
      subscriptionPlan: req.auth!.subscriptionPlan,
      isSuperAdmin: req.auth?.roles.includes("super_admin") ?? false,
    });

    res.json(summary);
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = leadQuerySchema.parse(req.query);
    const isSuperAdmin = req.auth?.roles.includes("super_admin") ?? false;

    let respondedEmails: string[] = [];
    if (query.engagedOnly === "true") {
      const incomingMessages = await prisma.emailMessage.findMany({
        where: {
          direction: EmailDirection.incoming,
          ...(!isSuperAdmin
            ? {
                OR: [
                  { sentByUserId: req.auth!.userId },
                  { thread: { is: { organizationId: req.auth!.userId } } },
                ],
              }
            : {}),
        },
        select: {
          fromEmail: true,
        },
      });
      respondedEmails = [...new Set(incomingMessages.map((m) => m.fromEmail.trim().toLowerCase()).filter(Boolean))];
    }

    const where = buildLeadWhere({
      userId: req.auth?.userId,
      isSuperAdmin,
      source: query.source,
      status: query.status,
      search: query.search,
      campaignId: query.campaignId,
      industry: query.industry,
      minInterestScore: query.minInterestScore,
      maxInterestScore: query.maxInterestScore,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      ids: query.ids,
      engagedOnly: query.engagedOnly,
      respondedEmails,
    });

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          campaign: {
            select: { id: true, businessType: true },
          },
          voiceContacts: {
            select: { callStatus: true, meetingBooked: true },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    const leadEmails = [...new Set(items.map((item) => item.email?.trim().toLowerCase()).filter(Boolean))] as string[];
    const sentMessages = leadEmails.length > 0
      ? await prisma.emailMessage.findMany({
        where: {
          direction: "outgoing",
          toEmail: { in: leadEmails },
          ...(isSuperAdmin ? {} : { sentByUserId: req.auth!.userId }),
        },
        select: {
          toEmail: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
      : [];

    const emailStatusByRecipient = new Map<string, { sentCount: number; lastSentAt: string }>();

    for (const message of sentMessages) {
      const key = message.toEmail.trim().toLowerCase();
      const existing = emailStatusByRecipient.get(key);

      if (existing) {
        existing.sentCount += 1;
      } else {
        emailStatusByRecipient.set(key, {
          sentCount: 1,
          lastSentAt: message.createdAt.toISOString(),
        });
      }
    }

    const mappedItems = items.map((item) => {
      const key = item.email?.trim().toLowerCase();
      const emailStatus = key ? emailStatusByRecipient.get(key) : undefined;
      const { voiceContacts, ...leadFields } = item;
      const voiceCampaignUsed = voiceContacts.length > 0;
      const latestCall = voiceContacts[0];

      return {
        ...leadFields,
        voiceCampaignUsed,
        voiceCallStatus: latestCall?.callStatus ?? null,
        emailStatus: emailStatus
          ? {
            sent: true,
            sentCount: emailStatus.sentCount,
            lastSentAt: emailStatus.lastSentAt,
          }
          : {
            sent: false,
            sentCount: 0,
            lastSentAt: null,
          },
      };
    });

    const filteredItems = mappedItems.filter((lead) => {
      const count = lead.emailStatus.sentCount;
      if (query.minEmailCount != null && count < query.minEmailCount) return false;
      if (query.maxEmailCount != null && count > query.maxEmailCount) return false;
      return true;
    });

    res.json({
      items: filteredItems,
      total: (query.minEmailCount != null || query.maxEmailCount != null) ? filteredItems.length : total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }),
);

router.post(
  "/meta/geocode",
  asyncHandler(async (req, res) => {
    const body = geocodeLocationsSchema.parse(req.body);
    const uniqueLocations = [...new Set(body.locations.map((value) => value.trim()).filter(Boolean))].slice(0, 100);

    const requests = uniqueLocations.map((location) => {
      const normalizedLocation = location.toLowerCase();
      return {
        location,
        normalizedLocation,
        persistentKey: getPersistentGeocodeKey(normalizedLocation),
      };
    });

    const persistentRows = requests.length > 0
      ? await prisma.appSetting.findMany({
        where: {
          key: {
            in: requests.map((item) => item.persistentKey),
          },
        },
        select: {
          key: true,
          value: true,
        },
      })
      : [];

    const persistedByKey = new Map(
      persistentRows.map((row) => [row.key, parsePersistedGeocode(row.value)] as const),
    );

    const items = await Promise.all(
      requests.map(async (item) => {
        const memoryHit = geocodeCache.get(item.normalizedLocation);
        if (memoryHit) {
          return {
            location: item.location,
            latitude: memoryHit.latitude,
            longitude: memoryHit.longitude,
          };
        }

        const persistedHit = persistedByKey.get(item.persistentKey) ?? null;
        if (persistedHit) {
          geocodeCache.set(item.normalizedLocation, persistedHit);
          return {
            location: item.location,
            latitude: persistedHit.latitude,
            longitude: persistedHit.longitude,
          };
        }

        const coords = await geocodeLocation(item.location);
        if (coords) {
          geocodeCache.set(item.normalizedLocation, coords);
          await prisma.appSetting.upsert({
            where: { key: item.persistentKey },
            create: {
              scope: "geocode",
              key: item.persistentKey,
              value: {
                location: item.location,
                normalizedLocation: item.normalizedLocation,
                latitude: coords.latitude,
                longitude: coords.longitude,
              } as Prisma.JsonObject,
            },
            update: {
              value: {
                location: item.location,
                normalizedLocation: item.normalizedLocation,
                latitude: coords.latitude,
                longitude: coords.longitude,
              } as Prisma.JsonObject,
            },
          });
        }

        return {
          location: item.location,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
        };
      }),
    );

    res.json({ items });
  }),
);

router.get(
  "/export",
  requirePlan("ai_lead_gen"),
  asyncHandler(async (req, res) => {
    const query = leadExportQuerySchema.parse(req.query);
    const isSuperAdmin = req.auth?.roles.includes("super_admin") ?? false;

    let respondedEmails: string[] = [];
    if (query.engagedOnly === "true") {
      const incomingMessages = await prisma.emailMessage.findMany({
        where: {
          direction: EmailDirection.incoming,
          ...(!isSuperAdmin
            ? {
                OR: [
                  { sentByUserId: req.auth!.userId },
                  { thread: { is: { organizationId: req.auth!.userId } } },
                ],
              }
            : {}),
        },
        select: {
          fromEmail: true,
        },
      });
      respondedEmails = [...new Set(incomingMessages.map((m) => m.fromEmail.trim().toLowerCase()).filter(Boolean))];
    }

    const where = buildLeadWhere({
      userId: req.auth?.userId,
      isSuperAdmin,
      source: query.source,
      status: query.status,
      search: query.search,
      campaignId: query.campaignId,
      industry: query.industry,
      minInterestScore: query.minInterestScore,
      maxInterestScore: query.maxInterestScore,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      engagedOnly: query.engagedOnly,
      respondedEmails,
    });

    const items = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
        status: true,
        outreachEnabled: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const exportedItems = items.map((item, index) => ({
      id: index + 1,
      ...item,
    }));

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "leads.export",
      entityType: "lead_export",
      metadata: {
        format: query.format,
        source: query.source ?? null,
        status: query.status ?? null,
        campaignId: query.campaignId ?? null,
        dateFrom: query.dateFrom?.toISOString() ?? null,
        dateTo: query.dateTo?.toISOString() ?? null,
        search: query.search ?? null,
        count: exportedItems.length,
      },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sourcePart = query.source ?? "all";
    const baseName = `leads-${sourcePart}-${timestamp}`;

    if (query.format === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}.json"`);
      return res.send(JSON.stringify(exportedItems, null, 2));
    }

    const csv = buildLeadCsv(
      exportedItems.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.csv"`);
    res.send(csv);
  }),
);

router.get(
  "/meta/dashboard",
  asyncHandler(async (req, res) => {
    const isSuperAdmin = req.auth?.roles.includes("super_admin") ?? false;
    const leadWhere = buildLeadWhere({
      userId: req.auth?.userId,
      isSuperAdmin,
    });
    const campaignWhere = !isSuperAdmin
      ? {
        createdById: req.auth?.userId,
      }
      : undefined;

    const emailScope = !isSuperAdmin
      ? {
          OR: [
            { sentByUserId: req.auth!.userId },
            { thread: { is: { organizationId: req.auth!.userId } } },
          ],
        }
      : {};

    const callScope = !isSuperAdmin
      ? {
          campaign: {
            createdById: req.auth!.userId,
          },
        }
      : {};

    const [leads, campaignCounts, totalEmails, connectedEmails, totalCalls, connectedCalls] = await Promise.all([
      prisma.lead.findMany({
        where: leadWhere,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          outreachEnabled: true,
          interestScore: true,
          industry: true,
          name: true,
          business: true,
        },
        take: 50000,
      }),
      prisma.leadCampaign.groupBy({
        by: ["status"],
        ...(campaignWhere ? { where: campaignWhere } : {}),
        _count: { _all: true },
      }),
      prisma.emailMessage.count({
        where: {
          ...emailScope,
          direction: "outgoing",
        },
      }),
      prisma.emailMessage.count({
        where: {
          ...emailScope,
          direction: "incoming",
        },
      }),
      prisma.voiceCampaignContact.count({
        where: callScope,
      }),
      prisma.voiceCampaignContact.count({
        where: {
          ...callScope,
          callStatus: { in: ["ended", "completed"] },
        },
      }),
    ]);

    res.json({
      items: leads,
      campaigns: campaignCounts,
      emailStats: {
        total: totalEmails,
        connected: connectedEmails,
      },
      callStats: {
        total: totalCalls,
        connected: connectedCalls,
      },
    });
  }),
);

router.get(
  "/campaigns/list",
  asyncHandler(async (req, res) => {
    const isSuperAdmin = req.auth?.roles.includes("super_admin") ?? false;
    const campaigns = await prisma.leadCampaign.findMany({
      where: {
        ...(!isSuperAdmin ? { createdById: req.auth!.userId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ items: campaigns });
  }),
);

router.get(
  "/campaigns/:id/ids",
  asyncHandler(async (req, res) => {
    const params = campaignIdParamsSchema.parse(req.params);
    const leads = await prisma.lead.findMany({
      where: {
        campaignId: params.id,
        email: { not: null },
      },
      select: { id: true },
    });
    res.json({ ids: leads.map((l) => l.id) });
  }),
);

router.post(
  "/campaigns",
  requirePlan("ai_lead_gen"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        source: z.nativeEnum(LeadSourceType),
        businessType: z.string().min(1).max(100),
        location: z.string().min(1).max(200),
        leadCount: z.coerce.number().int().positive().max(1000),
      })
      .parse(req.body);

    const creditSummary = await getLeadCreditSummary({
      userId: req.auth!.userId,
      subscriptionPlan: req.auth!.subscriptionPlan,
      isSuperAdmin: req.auth?.roles.includes("super_admin") ?? false,
    });

    if (!creditSummary.unlimited && body.leadCount > (creditSummary.remaining ?? 0)) {
      return res.status(400).json({
        message: `Lead credit limit exceeded. Remaining credits: ${creditSummary.remaining ?? 0}`,
      });
    }

    let externalResponse: unknown = null;
    let status: "pending" | "processing" | "failed" = "pending";
    let errorMessage: string | null = null;

    const webhookUrl =
      body.source === LeadSourceType.google_maps || body.source === LeadSourceType.yellow_pages || body.source === LeadSourceType.yelp
        ? ""
        : await (async () => {
          const settingKey = `integration.webhooks.${body.source}.lead_campaign`;
          const setting = await prisma.appSetting.findUnique({
            where: { key: settingKey },
          });

          return typeof setting?.value === "object" && setting?.value && "url" in (setting.value as Record<string, unknown>)
            ? String((setting.value as Record<string, unknown>).url ?? "")
            : "";
        })();

    const campaign = await prisma.leadCampaign.create({
      data: {
        source: body.source,
        businessType: body.businessType,
        location: body.location,
        leadCount: body.leadCount,
        createdById: req.auth?.userId,
        externalRequestUrl: webhookUrl || null,
        externalResponse: Prisma.JsonNull,
        status,
        errorMessage,
      },
    });
    console.log(`Created campaign with ID ${campaign.id} and source ${campaign.source}`);

    try {
      if (body.source === LeadSourceType.google_maps) {
        const job = await createGoogleMapsJob({
          campaignId: campaign.id,
          businessType: body.businessType,
          location: body.location,
          leadCount: body.leadCount,
        });
        externalResponse = job;
        status = "processing";
      } else if (body.source === LeadSourceType.yelp) {
        const job = await createYelpJob({
          campaignId: campaign.id,
          businessType: body.businessType,
          location: body.location,
          leadCount: body.leadCount,
        });
        externalResponse = job;
        status = "processing";
      } else if (body.source === LeadSourceType.yellow_pages) {
        const job = await createYellowPagesJob({
          campaignId: campaign.id,
          businessType: body.businessType,
          location: body.location,
          leadCount: body.leadCount,
        });
        externalResponse = job;
        status = "processing";
      } else if (webhookUrl) {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await response.text();
        externalResponse = { status: response.status, body: text };
        status = response.ok ? "processing" : "failed";
        if (!response.ok) {
          errorMessage = `Webhook failed with status ${response.status}`;
        }
      }
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : "Campaign request failed";
    }

    const updatedCampaign = await prisma.leadCampaign.update({
      where: { id: campaign.id },
      data: {
        externalResponse: (externalResponse ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
        status,
        errorMessage,
      },
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "lead_campaigns.create",
      entityType: "lead_campaign",
      entityId: updatedCampaign.id,
      metadata: body,
    });

    res.status(201).json({ item: updatedCampaign });
  }),
);

router.post(
  "/campaigns/import",
  requirePlan("ai_lead_gen"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        campaignName: z.string().min(1).max(100),
        location: z.string().optional().default("Imported"),
        leads: z
          .array(
            z.object({
              name: z.string().trim().min(1),
              business: z.string().trim().optional(),
              email: z.string().trim().nullable().optional(),
              phone: z.string().trim().nullable().optional(),
              website: z.string().trim().nullable().optional(),
              industry: z.string().trim().nullable().optional(),
              location: z.string().trim().nullable().optional(),
              address: z.string().trim().nullable().optional(),
              city: z.string().trim().nullable().optional(),
              state: z.string().trim().nullable().optional(),
            }).catchall(z.any()),
          )
          .min(1),
      })
      .parse(req.body);

    const creditSummary = await getLeadCreditSummary({
      userId: req.auth!.userId,
      subscriptionPlan: req.auth!.subscriptionPlan,
      isSuperAdmin: req.auth?.roles.includes("super_admin") ?? false,
    });

    if (!creditSummary.unlimited && body.leads.length > (creditSummary.remaining ?? 0)) {
      return res.status(400).json({
        message: `Lead credit limit exceeded. Remaining credits: ${creditSummary.remaining ?? 0}`,
      });
    }

    const standardKeys = [
      "name",
      "business",
      "email",
      "phone",
      "website",
      "industry",
      "location",
      "address",
      "city",
      "state",
    ];

    const customHeaders = new Set<string>();
    body.leads.forEach((lead) => {
      Object.keys(lead).forEach((key) => {
        if (!standardKeys.includes(key)) {
          customHeaders.add(key);
        }
      });
    });

    const campaign = await prisma.leadCampaign.create({
      data: {
        source: LeadSourceType.custom,
        businessType: body.campaignName,
        location: body.location,
        leadCount: body.leads.length,
        createdById: req.auth?.userId,
        status: "completed",
        externalResponse: {
          customHeaders: Array.from(customHeaders),
        } as never,
      },
    });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    await prisma.lead.createMany({
      data: body.leads.map((lead) => {
        const rawEmail = lead.email?.trim();
        const email = rawEmail && emailRegex.test(rawEmail) ? rawEmail.slice(0, 191) : null;
        
        const metadata: Record<string, any> = {};
        for (const [key, val] of Object.entries(lead)) {
          if (!standardKeys.includes(key)) {
            metadata[key] = val;
          }
        }

        console.log("Importing lead raw keys:", Object.keys(lead));
        console.log("Parsed metadata for lead:", JSON.stringify(metadata));

        return {
          campaignId: campaign.id,
          source: LeadSourceType.custom,
          name: lead.name.slice(0, 191),
          business: (lead.business || lead.name).slice(0, 191),
          email,
          phone: lead.phone ? lead.phone.slice(0, 191) : null,
          website: lead.website ? lead.website.slice(0, 191) : null,
          industry: lead.industry ? lead.industry.slice(0, 191) : null,
          location: (lead.location || body.location).slice(0, 191),
          address: lead.address ? lead.address.slice(0, 191) : null,
          city: lead.city ? lead.city.slice(0, 191) : null,
          state: lead.state ? lead.state.slice(0, 191) : null,
          status: "new",
          outreachEnabled: false,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
      }),
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "lead_campaigns.import",
      entityType: "lead_campaign",
      entityId: campaign.id,
      metadata: {
        campaignName: body.campaignName,
        leadCount: body.leads.length,
      },
    });

    const createdLeads = await prisma.lead.findMany({
      where: { campaignId: campaign.id },
      select: { id: true },
    });

    res.status(201).json({
      item: campaign,
      leadIds: createdLeads.map((lead) => lead.id),
    });
  }),
);


router.post(
  "/campaigns/:id/sync",
  requirePlan("ai_lead_gen"),
  asyncHandler(async (req, res) => {
    const params = campaignIdParamsSchema.parse(req.params);
    const campaign = await prisma.leadCampaign.findUnique({
      where: { id: params.id },
      select: { source: true },
    });

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    let result;

    if (campaign.source === LeadSourceType.google_maps) {
      result = await syncGoogleMapsCampaign(params.id);
    } else if (campaign.source === LeadSourceType.yelp) {
      result = await syncYelpCampaign(params.id);
    } else if (campaign.source === LeadSourceType.yellow_pages) {
      result = await syncYellowPagesCampaign(params.id);
    } else {
      return res.status(400).json({ message: "Sync is only available for local scraper campaigns" });
    }

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "lead_campaigns.sync",
      entityType: "lead_campaign",
      entityId: params.id,
      metadata: result,
    });

    res.json(result);
  }),
);

router.post(
  "/campaigns/:id/re-enrich-emails",
  requirePlan("ai_lead_gen"),
  asyncHandler(async (req, res) => {
    const params = campaignIdParamsSchema.parse(req.params);
    const isSuperAdmin = req.auth?.roles.includes("super_admin") ?? false;

    const campaign = await prisma.leadCampaign.findFirst({
      where: {
        id: params.id,
        ...(isSuperAdmin ? {} : { createdById: req.auth!.userId }),
      },
      select: {
        id: true,
        source: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    if (
      campaign.source !== LeadSourceType.google_maps &&
      campaign.source !== LeadSourceType.yelp &&
      campaign.source !== LeadSourceType.yellow_pages
    ) {
      return res.status(400).json({ message: "Email re-enrichment is only available for local scraper campaigns" });
    }

    const result = await reEnrichMissingLeadEmailsForCampaign(params.id);

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "lead_campaigns.re_enrich_emails",
      entityType: "lead_campaign",
      entityId: params.id,
      metadata: result,
    });

    res.json(result);
  }),
);

router.post(
  "/message-campaigns/brief",
  requirePlan("ai_lead_gen"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        leadIds: z.array(z.string()).min(1).max(50),
        description: z.string().optional(),
      })
      .parse(req.body);

    const uniqueLeadIds = [...new Set(body.leadIds)];
    const isSuperAdmin = req.auth?.roles.includes("super_admin") ?? false;
    const brandProfile = await getUserAiBrandProfile(req.auth!.userId);

    if (!brandProfile) {
      return res.status(400).json({ message: "Complete your AI Brand Profile before generating a campaign brief." });
    }

    const leads = await prisma.lead.findMany({
      where: {
        id: { in: uniqueLeadIds },
        email: { not: null },
        ...(!isSuperAdmin
          ? {
            campaign: {
              createdById: req.auth!.userId,
            },
          }
          : {}),
      },
      select: {
        id: true,
        name: true,
        business: true,
        industry: true,
        location: true,
        website: true,
      },
      take: 12,
    });

    if (leads.length === 0) {
      return res.status(400).json({ message: "No valid leads were found to generate a campaign brief." });
    }

    const brief = await generateAiCampaignBrief({
      brandProfile,
      source: "all",
      description: body.description,
      leads,
    });

    if (!brief) {
      return res.status(400).json({ message: "AI provider is unavailable or did not return a campaign brief." });
    }

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "message_campaigns.brief.generate",
      entityType: "lead_campaign",
      metadata: {
        source: "all",
        selectedLeadCount: uniqueLeadIds.length,
        sampledLeadCount: leads.length,
      },
    });

    res.json({ brief });
  }),
);

router.post(
  "/message-campaigns",
  requirePlan("ai_lead_gen"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        leadIds: z.array(z.string()).min(1).max(100000),
        campaignType: z.enum(["ai", "manual", "automated"]).default("ai"),
        pitch: z.string().max(5000).optional().default(""),
        subjectTemplate: z.string().max(255).optional().default(""),
        bodyTemplate: z.string().max(10000).optional().default(""),
        triggerRule: z
          .object({
            dateFieldKey: z.string().min(1),
            daysOffset: z.coerce.number().int(),
            timingType: z.enum(["before", "on", "after"]),
          })
          .optional(),
        scheduledAt: z.string().datetime().optional(),
      })
      .parse(req.body);

    if (body.campaignType === "manual" || body.campaignType === "automated") {
      if (!body.subjectTemplate.trim() || !body.bodyTemplate.trim()) {
        return res.status(400).json({ message: "Subject and Message templates are required for custom/automated campaigns." });
      }
      if (body.campaignType === "automated" && !body.triggerRule) {
        return res.status(400).json({ message: "Trigger rule configuration is required for automated campaigns." });
      }
    } else {
      if (body.pitch.trim().length < 20) {
        return res.status(400).json({ message: "Campaign brief is too short (minimum 20 characters) for AI outreach." });
      }
    }

    const uniqueLeadIds = [...new Set(body.leadIds)];
    const isSuperAdmin = req.auth?.roles.includes("super_admin") ?? false;

    const leads = await prisma.lead.findMany({
      where: {
        id: { in: uniqueLeadIds },
        email: { not: null },
        ...(!isSuperAdmin
          ? {
            campaign: {
              createdById: req.auth!.userId,
            },
          }
          : {}),
      },
      select: {
        id: true,
        source: true,
      },
    });

    if (leads.length === 0) {
      return res.status(400).json({ message: "No valid leads with email were selected" });
    }

    const selectedSources = [...new Set(leads.map((lead) => lead.source))];
    const campaignSource = selectedSources.length === 1 ? selectedSources[0] : LeadSourceType.custom;
    const campaign = await createMessageAutomationCampaign({
      userId: req.auth!.userId,
      source: campaignSource,
      pitch: body.pitch,
      leadIds: leads.map((lead) => lead.id),
      campaignType: body.campaignType,
      subjectTemplate: body.subjectTemplate,
      bodyTemplate: body.bodyTemplate,
      triggerRule: body.triggerRule,
      scheduledAt: body.scheduledAt,
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "message_campaigns.create",
      entityType: "lead_campaign",
      entityId: campaign.id,
      metadata: {
        source: campaignSource,
        selectedSources,
        selectedLeadCount: leads.length,
        campaignType: body.campaignType,
      },
    });

    res.status(201).json({ item: campaign });
  }),
);

router.get(
  "/message-campaigns",
  requirePlan("ai_lead_gen"),
  asyncHandler(async (req, res) => {
    const isSuperAdmin = req.auth?.roles.includes("super_admin") ?? false;
    const items = await prisma.leadCampaign.findMany({
      where: {
        ...(!isSuperAdmin ? { createdById: req.auth!.userId } : {}),
        businessType: "AI Email Automation",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({ items });
  }),
);

router.get(
  "/message-campaigns/:id",
  requirePlan("ai_lead_gen"),
  asyncHandler(async (req, res) => {
    const params = campaignIdParamsSchema.parse(req.params);
    const isSuperAdmin = req.auth?.roles.includes("super_admin") ?? false;
    const campaign = await prisma.leadCampaign.findFirst({
      where: {
        id: params.id,
        businessType: "AI Email Automation",
        ...(!isSuperAdmin ? { createdById: req.auth!.userId } : {}),
      },
    });

    if (!campaign) {
      return res.status(404).json({ message: "Automation campaign not found" });
    }

    res.json({ item: campaign });
  }),
);

router.post(
  "/messages",
  requirePlan("ai_lead_gen"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        source: z.nativeEnum(LeadSourceType),
        message: z.string().min(1).max(5000),
      })
      .parse(req.body);

    const settingKey = `integration.webhooks.${body.source}.message_campaign`;
    const setting = await prisma.appSetting.findUnique({ where: { key: settingKey } });
    const webhookUrl = typeof setting?.value === "object" && setting?.value && "url" in (setting.value as Record<string, unknown>)
      ? String((setting.value as Record<string, unknown>).url ?? "")
      : "";

    if (!webhookUrl) {
      return res.status(400).json({ message: "No message webhook configured for this source" });
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const raw = await response.text();
    if (!response.ok) {
      return res.status(502).json({ message: "Message webhook failed", detail: raw });
    }

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "message_campaigns.send",
      entityType: "message_campaign",
      metadata: body,
    });

    res.status(201).json({ success: true, response: raw });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const params = campaignIdParamsSchema.parse(req.params);
    const lead = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json({ item: lead });
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const params = campaignIdParamsSchema.parse(req.params);
    const body = z
      .object({
        name: z.string().trim().min(1).optional(),
        business: z.string().trim().min(1).optional(),
        status: z.nativeEnum(LeadStatus).optional(),
        outreachEnabled: z.boolean().optional(),
        interestScore: z.number().int().min(0).max(10).nullable().optional(),
        email: z.string().trim().email().nullable().optional(),
        phone: z.string().trim().nullable().optional(),
        website: z.string().trim().nullable().optional(),
        industry: z.string().trim().nullable().optional(),
        location: z.string().trim().nullable().optional(),
      })
      .parse(req.body);

    const updates = {
      ...body,
      phone: body.phone === "" ? null : body.phone,
      website: body.website === "" ? null : body.website,
      industry: body.industry === "" ? null : body.industry,
      location: body.location === "" ? null : body.location,
    };

    const lead = await prisma.lead.update({
      where: { id: params.id },
      data: updates,
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "leads.update",
      entityType: "lead",
      entityId: lead.id,
      metadata: updates,
    });

    res.json({ item: lead });
  }),
);

export const leadsRouter = router;