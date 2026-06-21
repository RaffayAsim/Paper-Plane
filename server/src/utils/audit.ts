import { Prisma } from "../generated/prisma/index.js";
import { prisma } from "../lib/prisma.js";

export async function writeAuditLog(input: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonObject;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}
