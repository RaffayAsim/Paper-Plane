import { prisma } from "./prisma.js";
import { config } from "./config.js";

const VAPI_ACCOUNT_KEY_PREFIX = "integration.vapi.user.";

export type UserVapiAccount = {
  apiKey: string;
  updatedAt?: string;
};

function getUserVapiAccountKey(userId: string) {
  return `${VAPI_ACCOUNT_KEY_PREFIX}${userId}`;
}

export async function getUserVapiAccount(userId: string) {
  const setting = await prisma.appSetting.findUnique({
    where: { key: getUserVapiAccountKey(userId) },
  });

  const value = setting?.value as UserVapiAccount | null | undefined;
  if (!value?.apiKey) {
    return null;
  }

  return {
    apiKey: value.apiKey,
    updatedAt: value.updatedAt,
  } satisfies UserVapiAccount;
}

export async function saveUserVapiAccount(userId: string, input: { apiKey: string }) {
  const next = {
    apiKey: input.apiKey,
    updatedAt: new Date().toISOString(),
  } satisfies UserVapiAccount;

  await prisma.appSetting.upsert({
    where: { key: getUserVapiAccountKey(userId) },
    update: { value: next as never },
    create: { key: getUserVapiAccountKey(userId), value: next as never },
  });

  return next;
}

export async function deleteUserVapiAccount(userId: string) {
  await prisma.appSetting.deleteMany({
    where: { key: getUserVapiAccountKey(userId) },
  });
}

export async function resolveVapiAuthForUser(userId?: string | null) {
  if (userId) {
    const account = await getUserVapiAccount(userId);
    if (account?.apiKey) {
      return {
        apiKey: account.apiKey,
        baseUrl: config.VAPI_BASE_URL,
        source: "user" as const,
      };
    }
  }

  if (!config.VAPI_API_KEY) {
    throw new Error("Vapi is not configured. Add VAPI_API_KEY in server/.env or connect a personal Vapi key.");
  }

  return {
    apiKey: config.VAPI_API_KEY,
    baseUrl: config.VAPI_BASE_URL,
    source: "env" as const,
  };
}

export function maskVapiApiKey(value: string) {
  if (value.length <= 8) {
    return "••••••••";
  }

  return `${value.slice(0, 4)}••••••${value.slice(-4)}`;
}
