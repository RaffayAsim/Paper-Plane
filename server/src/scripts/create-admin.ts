import { RoleName } from "../generated/prisma/index.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../utils/password.js";

async function createAdmin() {
  const email = "zeeshanm@quantumarc.us".toLowerCase();
  const password = "zxc12345";
  const displayName = "Zeeshan M";

  // Ensure role exists
  const superAdminRole = await prisma.role.upsert({
    where: { name: RoleName.super_admin },
    update: {},
    create: { name: RoleName.super_admin },
  });

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      displayName,
      passwordHash: hashedPassword,
      isActive: true,
    },
    create: {
      email,
      displayName,
      passwordHash: hashedPassword,
      isActive: true,
    },
  });

  // Assign role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: superAdminRole.id,
    },
  });

  console.log(`Successfully created/updated super_admin user: ${user.email}`);
}

createAdmin()
  .catch((err) => {
    console.error("Error creating admin:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
