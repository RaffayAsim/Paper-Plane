import { prisma } from "./prisma.js";

export type UserAiBrandProfile = {
  brandName: string;
  brandGuidelines: string;
  services: string;
  pricing: string;
  salesEmail: string;
  contactPersons: string;
  autoReplyEnabled: boolean;
  industry?: string;
  companySize?: string;
  domainName?: string;
  onboardedAt?: string;
  updatedAt?: string;
  setupStatus?: string;
  emailSetupType?: string;
};

function getUserAiBrandProfileKey(userId: string) {
  return `user.ai_brand_profile.${userId}`;
}

export async function getUserAiBrandProfile(userId: string) {
  const setting = await prisma.appSetting.findUnique({
    where: { key: getUserAiBrandProfileKey(userId) },
  });

  const value = setting?.value as UserAiBrandProfile | null | undefined;
  if (!value) return null;

  return {
    brandName: value.brandName || "",
    brandGuidelines: value.brandGuidelines || "",
    services: value.services || "",
    pricing: value.pricing || "",
    salesEmail: value.salesEmail || "",
    contactPersons: value.contactPersons || "",
    autoReplyEnabled: Boolean(value.autoReplyEnabled),
    industry: value.industry || "",
    companySize: value.companySize || "",
    domainName: value.domainName || "",
    onboardedAt: value.onboardedAt || undefined,
    updatedAt: value.updatedAt || undefined,
    setupStatus: value.setupStatus || undefined,
    emailSetupType: value.emailSetupType || undefined,
  } satisfies UserAiBrandProfile;
}

export async function saveUserAiBrandProfile(userId: string, profile: UserAiBrandProfile) {
  const existing = await getUserAiBrandProfile(userId);
  const next = {
    brandName: profile.brandName,
    brandGuidelines: profile.brandGuidelines,
    services: profile.services,
    pricing: profile.pricing,
    salesEmail: profile.salesEmail,
    contactPersons: profile.contactPersons,
    autoReplyEnabled: Boolean(profile.autoReplyEnabled),
    industry: profile.industry || "",
    companySize: profile.companySize || "",
    domainName: profile.domainName || "",
    onboardedAt: profile.onboardedAt || existing?.onboardedAt || undefined,
    setupStatus: profile.setupStatus || existing?.setupStatus || undefined,
    emailSetupType: profile.emailSetupType || existing?.emailSetupType || undefined,
    updatedAt: new Date().toISOString(),
  } satisfies UserAiBrandProfile;

  await prisma.appSetting.upsert({
    where: { key: getUserAiBrandProfileKey(userId) },
    update: { value: next as never },
    create: {
      key: getUserAiBrandProfileKey(userId),
      scope: `user:${userId}`,
      value: next as never,
    },
  });

  return next;
}
