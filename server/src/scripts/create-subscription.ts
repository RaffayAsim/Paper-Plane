import { prisma } from "../lib/prisma.js";

async function run() {
  const userId = "cmpvapwk90001jovhxb5fo86a";
  
  // Verify user exists first
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    console.error(`Error: User with ID ${userId} not found in the database.`);
    process.exit(1);
  }
  
  console.log(`Found user: ${user.email} (${user.displayName})`);
  
  const existingSub = await prisma.subscription.findFirst({
    where: { userId: userId }
  });

  let subscription;
  if (existingSub) {
    subscription = await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        status: "active",
        planName: "ai_lead_gen",
        currentPeriodEnd: new Date("2030-01-01"),
        cancelAtPeriodEnd: false,
      }
    });
  } else {
    subscription = await prisma.subscription.create({
      data: {
        userId: userId,
        status: "active",
        planName: "ai_lead_gen",
        currentPeriodEnd: new Date("2030-01-01"),
        cancelAtPeriodEnd: false,
      }
    });
  }
  
  console.log("Successfully created/updated subscription:", subscription);
}

run()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
