import { RoleName } from "../../generated/prisma/index.js";
import { type NextFunction, type Request, type Response, Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ImapFlow } from "imapflow";
import { z } from "zod";
import { getUserAiBrandProfile, saveUserAiBrandProfile } from "../../lib/ai-brand-profile.js";
import { getAiProviderConfig, saveUserAiProviderConfig } from "../../lib/ai-settings.js";
import { applyDefaultRule, getSmtpConfigs, normalizeSmtpConfig, saveSmtpConfigs } from "../../lib/email-settings.js";
import { createTransportForConfig } from "../../lib/mailer.js";
import { prisma } from "../../lib/prisma.js";
import { deleteUserVapiAccount, getUserVapiAccount, maskVapiApiKey, saveUserVapiAccount } from "../../lib/vapi-settings.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { writeAuditLog } from "../../utils/audit.js";

const router = Router();

const adminSettingsSchema = z.object({
  app: z.object({
    leadCampaignWebhook: z.string().url().or(z.literal("")).default(""),
    airtableApiKey: z.string().default(""),
    airtableBaseId: z.string().default(""),
    airtableTableName: z.string().default("Leads"),
  }),
  webhooks: z.object({
    mapLeads: z.string().default(""),
    yelpLeads: z.string().default(""),
    yellowPageLeads: z.string().default(""),
    mapMessage: z.string().default(""),
    yelpMessage: z.string().default(""),
    yellowPageMessage: z.string().default(""),
    mapTable: z.string().default(""),
    yelpTable: z.string().default(""),
    yellowPageTable: z.string().default(""),
    dynamicButtons: z.array(z.object({
      name: z.string(),
      url: z.string(),
    })).default([]),
  }),
});

async function getAllSettings() {
  const settings = await prisma.appSetting.findMany();
  const map = new Map(settings.map((item) => [item.key, item.value]));

  return {
    app: {
      leadCampaignWebhook: String(map.get("app.leadCampaignWebhook") ?? ""),
      airtableApiKey: String(map.get("app.airtableApiKey") ?? ""),
      airtableBaseId: String(map.get("app.airtableBaseId") ?? ""),
      airtableTableName: String(map.get("app.airtableTableName") ?? "Leads"),
    },
    webhooks: {
      mapLeads: String(((map.get("integration.webhooks.google_maps.lead_campaign") as { url?: string })?.url) ?? ""),
      yelpLeads: String(((map.get("integration.webhooks.yelp.lead_campaign") as { url?: string })?.url) ?? ""),
      yellowPageLeads: String(((map.get("integration.webhooks.yellow_pages.lead_campaign") as { url?: string })?.url) ?? ""),
      mapMessage: String(((map.get("integration.webhooks.google_maps.message_campaign") as { url?: string })?.url) ?? ""),
      yelpMessage: String(((map.get("integration.webhooks.yelp.message_campaign") as { url?: string })?.url) ?? ""),
      yellowPageMessage: String(((map.get("integration.webhooks.yellow_pages.message_campaign") as { url?: string })?.url) ?? ""),
      mapTable: String(map.get("integration.tables.google_maps") ?? ""),
      yelpTable: String(map.get("integration.tables.yelp") ?? ""),
      yellowPageTable: String(map.get("integration.tables.yellow_pages") ?? ""),
      dynamicButtons: (map.get("integration.dynamicButtons") as { name: string; url: string }[]) ?? [],
    },
  };
}

router.use(requireAuth);

function requireCustomEmailAccess(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.roles?.includes("super_admin")) {
    return next();
  }

  if (req.auth?.subscriptionPlan === "ai_lead_gen" || req.auth?.subscriptionPlan === "base") {
    return next();
  }

  return res.status(403).json({ message: "Custom email accounts require the AI Lead Gen plan" });
}

const userEmailConfigSchema = z.object({
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

function getConnectionErrorMessage(prefix: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown connection error";
  return `${prefix}: ${message}`;
}

async function validateEmailAccountConnections(input: z.infer<typeof userEmailConfigSchema>) {
  if (!input.imapHost || !input.imapUser || !input.imapPass) {
    throw new Error("IMAP settings are required and must include host, username, and password");
  }

  const normalized = normalizeSmtpConfig(input as z.infer<typeof userEmailConfigSchema> & {
    id?: never;
    createdAt?: never;
    updatedAt?: never;
  });

  const transport = createTransportForConfig(normalized);

  if (typeof transport.verify !== "function") {
    throw new Error("SMTP validation is unavailable for this transport");
  }

  try {
    await transport.verify();
  } catch (error) {
    throw new Error(getConnectionErrorMessage("SMTP connection failed", error));
  }

  const imapClient = new ImapFlow({
    host: normalized.imapHost!,
    port: normalized.imapPort ?? 993,
    secure: typeof normalized.imapSecure === "boolean" ? normalized.imapSecure : true,
    auth: {
      user: normalized.imapUser!,
      pass: normalized.imapPass!,
    },
    logger: false,
  });

  try {
    await imapClient.connect();
    const lock = await imapClient.getMailboxLock("INBOX");
    lock.release();
  } catch (error) {
    throw new Error(getConnectionErrorMessage("IMAP connection failed", error));
  } finally {
    await imapClient.logout().catch(() => undefined);
  }
}

const userAiBrandProfileSchema = z.object({
  brandName: z.string().max(200).default(""),
  brandGuidelines: z.string().max(10000).default(""),
  services: z.string().max(10000).default(""),
  pricing: z.string().max(10000).default(""),
  salesEmail: z.string().email().or(z.literal("")).default(""),
  contactPersons: z.string().max(5000).default(""),
  autoReplyEnabled: z.boolean().default(true),
  industry: z.string().max(2000).optional().default(""),
  companySize: z.string().max(200).optional().default(""),
  domainName: z.string().max(200).optional().default(""),
  onboardedAt: z.string().optional(),
  setupStatus: z.string().optional(),
  emailSetupType: z.string().optional(),
});

const userVapiAccountSchema = z.object({
  apiKey: z.string().min(8).max(255),
});

router.get(
  "/email-accounts",
  requireCustomEmailAccess,
  asyncHandler(async (req, res) => {
    const items = (await getSmtpConfigs()).filter((item) => item.ownerUserId === req.auth!.userId);
    res.json({ items });
  }),
);

router.post(
  "/email-accounts",
  requireCustomEmailAccess,
  asyncHandler(async (req, res) => {
    const body = userEmailConfigSchema.parse(req.body);
    await validateEmailAccountConnections(body);
    const allConfigs = await getSmtpConfigs();
    const ownConfigs = allConfigs.filter((item) => item.ownerUserId === req.auth!.userId);
    const others = allConfigs.filter((item) => item.ownerUserId !== req.auth!.userId);
    const created = normalizeSmtpConfig(body);
    const nextOwn = applyDefaultRule([
      ...ownConfigs,
      {
        ...created,
        ownerUserId: req.auth!.userId,
        assignedUserId: req.auth!.userId,
        assignedAt: new Date().toISOString(),
      },
    ]);

    await saveSmtpConfigs([...others, ...nextOwn]);

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "settings.email_account.create",
      entityType: "smtp_config",
      entityId: created.id,
    });

    res.status(201).json({ items: nextOwn });
  }),
);

router.patch(
  "/email-accounts/:id",
  requireCustomEmailAccess,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = userEmailConfigSchema.parse(req.body);
    await validateEmailAccountConnections(body);
    const allConfigs = await getSmtpConfigs();
    const ownConfigs = allConfigs.filter((item) => item.ownerUserId === req.auth!.userId);
    const others = allConfigs.filter((item) => item.ownerUserId !== req.auth!.userId);
    const existing = ownConfigs.find((item) => item.id === id);

    if (!existing) {
      return res.status(404).json({ message: "SMTP config not found" });
    }

    const nextOwn = applyDefaultRule(
      ownConfigs.map((item) =>
        item.id === id
          ? normalizeSmtpConfig(body, item.id, item.createdAt, item)
          : item,
      ),
    );

    await saveSmtpConfigs([...others, ...nextOwn]);

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "settings.email_account.update",
      entityType: "smtp_config",
      entityId: id,
    });

    res.json({ items: nextOwn });
  }),
);

router.delete(
  "/email-accounts/:id",
  requireCustomEmailAccess,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const allConfigs = await getSmtpConfigs();
    const ownConfigs = allConfigs.filter((item) => item.ownerUserId === req.auth!.userId);
    const others = allConfigs.filter((item) => item.ownerUserId !== req.auth!.userId);
    const existing = ownConfigs.find((item) => item.id === id);

    if (!existing) {
      return res.status(404).json({ message: "SMTP config not found" });
    }

    const nextOwn = applyDefaultRule(ownConfigs.filter((item) => item.id !== id));
    await saveSmtpConfigs([...others, ...nextOwn]);

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "settings.email_account.delete",
      entityType: "smtp_config",
      entityId: id,
    });

    res.status(204).send();
  }),
);

function requireCompanyProfileAccess(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.roles?.includes("super_admin")) {
    return next();
  }

  const plan = req.auth?.subscriptionPlan;
  if (plan === "ai_lead_gen" || plan === "base") {
    return next();
  }

  return res.status(403).json({ message: "Company profile requires the AI Lead Gen plan" });
}

function requireTierThreeVapiAccess(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.roles?.includes("super_admin")) {
    return next();
  }

  if (req.auth?.subscriptionPlan === "ai_lead_gen") {
    return next();
  }

  return res.status(403).json({ message: "Custom Vapi accounts require the AI Lead Gen plan" });
}

router.get(
  "/ai-brand-profile",
  requireCompanyProfileAccess,
  asyncHandler(async (req, res) => {
    res.json({ item: await getUserAiBrandProfile(req.auth!.userId) });
  }),
);

router.put(
  "/ai-brand-profile",
  requireCompanyProfileAccess,
  asyncHandler(async (req, res) => {
    const body = userAiBrandProfileSchema.parse(req.body);
    const item = await saveUserAiBrandProfile(req.auth!.userId, body);

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "settings.ai_brand_profile.update",
      entityType: "app_settings",
      metadata: {
        autoReplyEnabled: item.autoReplyEnabled,
        brandName: item.brandName,
        salesEmail: item.salesEmail,
      },
    });

    res.json({ item });
  }),
);

const userAiSettingsSchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini", "openai_compatible"]),
  apiKey: z.string().min(1).max(500),
  model: z.string().min(1).max(200),
  baseUrl: z.string().url().optional().or(z.literal("")),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  isActive: z.boolean().default(true),
});

router.get(
  "/ai-settings",
  asyncHandler(async (req, res) => {
    const config = await getAiProviderConfig(req.auth!.userId);
    res.json({ item: config });
  }),
);

router.put(
  "/ai-settings",
  asyncHandler(async (req, res) => {
    const body = userAiSettingsSchema.parse(req.body);
    const item = await saveUserAiProviderConfig(req.auth!.userId, {
      provider: body.provider,
      apiKey: body.apiKey,
      model: body.model,
      baseUrl: body.baseUrl || undefined,
      temperature: body.temperature,
      isActive: body.isActive,
    });

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "settings.ai_settings.update",
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
  "/vapi-account",
  requireTierThreeVapiAccess,
  asyncHandler(async (req, res) => {
    const item = await getUserVapiAccount(req.auth!.userId);
    const defaultKeyAvailable = Boolean(process.env.VAPI_API_KEY);
    const activeSource = item?.apiKey ? "custom" : defaultKeyAvailable ? "shared" : "unconfigured";

    res.json({
      item: {
        hasCustomKey: Boolean(item?.apiKey),
        maskedApiKey: item?.apiKey ? maskVapiApiKey(item.apiKey) : null,
        updatedAt: item?.updatedAt ?? null,
        defaultKeyAvailable,
        activeSource,
      },
    });
  }),
);

router.put(
  "/vapi-account",
  requireTierThreeVapiAccess,
  asyncHandler(async (req, res) => {
    const body = userVapiAccountSchema.parse(req.body);
    const item = await saveUserVapiAccount(req.auth!.userId, body);

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "settings.vapi_account.update",
      entityType: "app_settings",
      metadata: {
        hasCustomKey: true,
      },
    });

    res.json({
      item: {
        hasCustomKey: true,
        maskedApiKey: maskVapiApiKey(item.apiKey),
        updatedAt: item.updatedAt ?? null,
        defaultKeyAvailable: Boolean(process.env.VAPI_API_KEY),
        activeSource: "custom",
      },
    });
  }),
);

router.delete(
  "/vapi-account",
  requireTierThreeVapiAccess,
  asyncHandler(async (req, res) => {
    await deleteUserVapiAccount(req.auth!.userId);

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "settings.vapi_account.delete",
      entityType: "app_settings",
      metadata: {
        hasCustomKey: false,
      },
    });

    res.status(204).send();
  }),
);

router.get(
  "/",
  requireRole([RoleName.super_admin]),
  asyncHandler(async (_req, res) => {
    res.json(await getAllSettings());
  }),
);

router.put(
  "/",
  requireRole([RoleName.super_admin]),
  asyncHandler(async (req, res) => {
    const body = adminSettingsSchema.parse(req.body);

    const entries: Array<[string, unknown]> = [
      ["app.leadCampaignWebhook", body.app.leadCampaignWebhook],
      ["app.airtableApiKey", body.app.airtableApiKey],
      ["app.airtableBaseId", body.app.airtableBaseId],
      ["app.airtableTableName", body.app.airtableTableName],
      ["integration.webhooks.google_maps.lead_campaign", { url: body.webhooks.mapLeads }],
      ["integration.webhooks.yelp.lead_campaign", { url: body.webhooks.yelpLeads }],
      ["integration.webhooks.yellow_pages.lead_campaign", { url: body.webhooks.yellowPageLeads }],
      ["integration.webhooks.google_maps.message_campaign", { url: body.webhooks.mapMessage }],
      ["integration.webhooks.yelp.message_campaign", { url: body.webhooks.yelpMessage }],
      ["integration.webhooks.yellow_pages.message_campaign", { url: body.webhooks.yellowPageMessage }],
      ["integration.tables.google_maps", body.webhooks.mapTable],
      ["integration.tables.yelp", body.webhooks.yelpTable],
      ["integration.tables.yellow_pages", body.webhooks.yellowPageTable],
      ["integration.dynamicButtons", body.webhooks.dynamicButtons],
    ];

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.appSetting.upsert({
          where: { key },
          update: { value: value as never },
          create: { key, value: value as never },
        }),
      ),
    );

    await writeAuditLog({
      actorUserId: req.auth?.userId,
      action: "settings.update",
      entityType: "app_settings",
      metadata: { keys: entries.map(([key]) => key) },
    });

    res.json(await getAllSettings());
  }),
);

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

router.post(
  "/upload-image",
  asyncHandler(async (req, res) => {
    const body = z.object({
      name: z.string().min(1),
      content: z.string().min(1),
    }).parse(req.body);

    const matches = body.content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ message: "Invalid base64 image content structure" });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    let extension = "png";
    if (mimeType.includes("jpeg")) extension = "jpg";
    else if (mimeType.includes("gif")) extension = "gif";
    else if (mimeType.includes("webp")) extension = "webp";
    else if (mimeType.includes("svg")) extension = "svg";

    const fileName = `${randomUUID()}.${extension}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    await fs.promises.writeFile(filePath, buffer);

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${fileName}`;
    res.status(201).json({ url: fileUrl });
  }),
);

export const settingsRouter = router;
