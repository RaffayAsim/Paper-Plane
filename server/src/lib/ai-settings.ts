import { prisma } from "./prisma.js";

export type AiProvider = "openai" | "anthropic" | "gemini" | "openai_compatible";

export type AiProviderConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  isActive: boolean;
  updatedAt?: string;
};

const AI_SETTINGS_KEY = "ai.provider.config";

export async function getAiProviderConfig(userId?: string) {
  if (userId) {
    const key = `user.ai_settings.${userId}`;
    const setting = await prisma.appSetting.findUnique({
      where: { key },
    });

    const value = setting?.value as AiProviderConfig | null | undefined;
    if (value) {
      return {
        provider: value.provider,
        apiKey: value.apiKey || "",
        model: value.model || "",
        baseUrl: value.baseUrl || undefined,
        temperature: typeof value.temperature === "number" ? value.temperature : 0.7,
        isActive: Boolean(value.isActive),
        updatedAt: value.updatedAt || undefined,
      } satisfies AiProviderConfig;
    }
    return null;
  }

  const setting = await prisma.appSetting.findUnique({
    where: { key: AI_SETTINGS_KEY },
  });

  const value = setting?.value as AiProviderConfig | null | undefined;
  if (!value) return null;

  return {
    provider: value.provider,
    apiKey: value.apiKey || "",
    model: value.model || "",
    baseUrl: value.baseUrl || undefined,
    temperature: typeof value.temperature === "number" ? value.temperature : 0.7,
    isActive: Boolean(value.isActive),
    updatedAt: value.updatedAt || undefined,
  } satisfies AiProviderConfig;
}

export async function saveAiProviderConfig(config: AiProviderConfig) {
  const next = {
    ...config,
    temperature: typeof config.temperature === "number" ? config.temperature : 0.7,
    updatedAt: new Date().toISOString(),
  };

  await prisma.appSetting.upsert({
    where: { key: AI_SETTINGS_KEY },
    update: { value: next as never },
    create: { key: AI_SETTINGS_KEY, value: next as never },
  });

  return next;
}

export async function saveUserAiProviderConfig(userId: string, config: AiProviderConfig) {
  const key = `user.ai_settings.${userId}`;
  const next = {
    ...config,
    temperature: typeof config.temperature === "number" ? config.temperature : 0.7,
    updatedAt: new Date().toISOString(),
  };

  await prisma.appSetting.upsert({
    where: { key },
    update: { value: next as never },
    create: {
      key,
      scope: `user:${userId}`,
      value: next as never,
    },
  });

  return next;
}
