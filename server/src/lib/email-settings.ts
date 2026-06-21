import { randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";

export type SmtpConfig = {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapUser?: string;
  imapPass?: string;
  ownerUserId?: string;
  assignedUserId?: string;
  assignedAt?: string;
  dailySendLimit?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const SMTP_CONFIGS_KEY = "email.smtp.configs";

export async function getSmtpConfigs() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: SMTP_CONFIGS_KEY },
  });

  return ((setting?.value as SmtpConfig[] | null) ?? []).map((item) => ({
    ...item,
    port: Number(item.port),
    secure: Boolean(item.secure),
    imapPort: item.imapPort ? Number(item.imapPort) : undefined,
    imapSecure: typeof item.imapSecure === "boolean" ? item.imapSecure : undefined,
    ownerUserId: item.ownerUserId || undefined,
    assignedUserId: item.assignedUserId || undefined,
    assignedAt: item.assignedAt || undefined,
    dailySendLimit: item.dailySendLimit ? Number(item.dailySendLimit) : 50,
    isDefault: Boolean(item.isDefault),
    isActive: Boolean(item.isActive),
  }));
}

export async function saveSmtpConfigs(configs: SmtpConfig[]) {
  await prisma.appSetting.upsert({
    where: { key: SMTP_CONFIGS_KEY },
    update: { value: configs as never },
    create: { key: SMTP_CONFIGS_KEY, value: configs as never },
  });
}

export function normalizeSmtpConfig(
  input: Omit<SmtpConfig, "id" | "createdAt" | "updatedAt">,
  existingId?: string,
  createdAt?: string,
  existing?: Partial<SmtpConfig>,
): SmtpConfig {
  const now = new Date().toISOString();
  return {
    id: existingId ?? randomUUID(),
    name: input.name,
    host: input.host,
    port: Number(input.port),
    secure: Boolean(input.secure),
    user: input.user,
    pass: input.pass,
    fromEmail: input.fromEmail,
    imapHost: input.imapHost || undefined,
    imapPort: input.imapPort ? Number(input.imapPort) : undefined,
    imapSecure: typeof input.imapSecure === "boolean" ? input.imapSecure : undefined,
    imapUser: input.imapUser || undefined,
    imapPass: input.imapPass || undefined,
    ownerUserId: existing?.ownerUserId || undefined,
    assignedUserId: existing?.assignedUserId || undefined,
    assignedAt: existing?.assignedAt || undefined,
    dailySendLimit: input.dailySendLimit !== undefined ? Number(input.dailySendLimit) : (existing?.dailySendLimit ? Number(existing.dailySendLimit) : 50),
    isDefault: Boolean(input.isDefault),
    isActive: Boolean(input.isActive),
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

export function applyDefaultRule(configs: SmtpConfig[]) {
  let defaultAssigned = false;

  const normalized = configs.map((config) => {
    if (config.isDefault && config.isActive && !defaultAssigned) {
      defaultAssigned = true;
      return config;
    }

    return { ...config, isDefault: false };
  });

  if (!defaultAssigned) {
    const firstActiveIndex = normalized.findIndex((item) => item.isActive);
    if (firstActiveIndex >= 0) {
      normalized[firstActiveIndex] = { ...normalized[firstActiveIndex], isDefault: true };
    }
  }

  return normalized;
}

export function isImapConfigured(config: SmtpConfig) {
  return Boolean(config.imapHost && config.imapUser && config.imapPass);
}
