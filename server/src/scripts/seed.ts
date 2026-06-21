import { RoleName } from "../generated/prisma/index.js";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../utils/password.js";

async function seed() {
  const adminEmail = config.BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
  const existingRoles = await prisma.role.findMany({
    where: { name: { in: Object.values(RoleName) } },
  });
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  const allRolesExist = existingRoles.length === Object.values(RoleName).length;
  const adminHasSuperAdminRole = existingAdmin?.roles.some((entry) => entry.role.name === RoleName.super_admin) ?? false;



  for (const role of Object.values(RoleName)) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
    });
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.super_admin } });
  const hashedPassword = await hashPassword(config.BOOTSTRAP_ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      displayName: "Platform Admin",
      passwordHash: hashedPassword,
      isActive: true,
    },
    create: {
      email: adminEmail,
      displayName: "Platform Admin",
      passwordHash: hashedPassword,
      isActive: true,
    },
  });

  await prisma.userRole.deleteMany({ where: { userId: admin.id } });
  await prisma.userRole.create({
    data: {
      userId: admin.id,
      roleId: superAdminRole.id,
    },
  });

  console.log(`Seeded roles and bootstrap admin: ${admin.email}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
