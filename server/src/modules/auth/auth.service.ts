import type { RoleName } from "../../generated/prisma/index.js";
import type { SubscriptionPlan } from "../../lib/access.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { addDays } from "../../utils/dates.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { randomToken, sha256, signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/tokens.js";
import { writeAuditLog } from "../../utils/audit.js";
import { config } from "../../lib/config.js";

async function getUserWithRolesByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      roles: {
        include: { role: true },
      },
      subscriptions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });
}

function mapRoles(user: {
  roles: { role: { name: RoleName } }[];
}) {
  return user.roles.map((entry) => entry.role.name);
}

function resolveSubscriptionPlan(user: {
  subscriptions?: Array<{ planName: SubscriptionPlan; status: string }>;
}): SubscriptionPlan {
  const active = user.subscriptions?.find((entry) => entry.status === "active" || entry.status === "trialing");
  return active?.planName ?? "base";
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
  phoneNumber: string;
}) {
  const existing = await getUserWithRolesByEmail(input.email);
  if (existing) {
    throw new Error("Email is already registered");
  }

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName,
      phoneNumber: input.phoneNumber,
    },
    include: {
      roles: {
        include: { role: true },
      },
      subscriptions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "auth.register",
    entityType: "user",
    entityId: user.id,
  });

  return issueTokens(user);
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await getUserWithRolesByEmail(input.email);
  if (!user || !user.isActive) {
    throw new HttpError(401, "Invalid email or password");
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new HttpError(401, "Invalid email or password");
  }

  await writeAuditLog({
    actorUserId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
  });

  return issueTokens(user);
}

export async function refreshUserSession(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = sha256(refreshToken);

  const persisted = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          roles: { include: { role: true } },
          subscriptions: {
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!persisted || persisted.revokedAt || persisted.expiresAt < new Date()) {
    throw new HttpError(401, "Refresh token is invalid");
  }

  await prisma.refreshToken.update({
    where: { id: persisted.id },
    data: { revokedAt: new Date() },
  });

  const user = persisted.user;
  if (!user.isActive || user.id !== payload.userId) {
    throw new HttpError(401, "User not active");
  }

  return issueTokens(user, payload.impersonatedByUserId
    ? {
        userId: payload.impersonatedByUserId,
        email: payload.impersonatedByEmail ?? "",
        displayName: payload.impersonatedByDisplayName ?? "Admin",
      }
    : undefined);
}

export async function logoutUser(refreshToken: string) {
  const tokenHash = sha256(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function createPasswordResetToken(email: string) {
  const user = await getUserWithRolesByEmail(email);
  if (!user) {
    return { token: null };
  }

  const token = randomToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: addDays(new Date(), 1),
    },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "auth.forgot_password",
    entityType: "user",
    entityId: user.id,
  });

  return { token };
}

export async function resetPassword(resetToken: string, nextPassword: string) {
  const tokenHash = sha256(resetToken);
  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
    throw new HttpError(400, "Password reset token is invalid");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash: await hashPassword(nextPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: resetRecord.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    actorUserId: resetRecord.userId,
    action: "auth.reset_password",
    entityType: "user",
    entityId: resetRecord.userId,
  });
}

export async function issueTokens(user: {
  id: string;
  email: string;
  displayName: string;
  roles: { role: { name: RoleName } }[];
  subscriptions?: Array<{ planName: SubscriptionPlan; status: string }>;
}, impersonatedBy?: { userId: string; email: string; displayName: string }) {
  const roles = mapRoles(user);
  const subscriptionPlan = resolveSubscriptionPlan(user);
  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    roles,
    subscriptionPlan,
    impersonatedByUserId: impersonatedBy?.userId,
    impersonatedByEmail: impersonatedBy?.email,
    impersonatedByDisplayName: impersonatedBy?.displayName,
  });
  const refreshToken = signRefreshToken({
    userId: user.id,
    impersonatedByUserId: impersonatedBy?.userId,
    impersonatedByEmail: impersonatedBy?.email,
    impersonatedByDisplayName: impersonatedBy?.displayName,
  });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: addDays(new Date(), config.JWT_REFRESH_TTL_DAYS),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles,
      subscriptionPlan,
      impersonatedBy: impersonatedBy ?? null,
    },
  };
}
