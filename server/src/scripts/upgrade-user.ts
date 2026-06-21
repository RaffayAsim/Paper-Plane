import { prisma } from "../lib/prisma.js";
import { SubscriptionPlan, SubscriptionStatus } from "../generated/prisma/index.js";

async function main() {
  const email = process.argv[2];
  const plan = process.argv[3]; // ai_lead_gen

  if (!email || !plan) {
    console.error("Usage: npx tsx src/scripts/upgrade-user.ts <email> <ai_lead_gen>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  const validPlans = ["ai_lead_gen"];
  if (!validPlans.includes(plan)) {
    console.error(`Invalid plan. Choose one of: ${validPlans.join(", ")}`);
    process.exit(1);
  }

  // Delete any old subscriptions to avoid duplicates
  await prisma.subscription.deleteMany({
    where: { userId: user.id },
  });

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      status: SubscriptionStatus.active,
      planName: plan as SubscriptionPlan,
    },
  });

  console.log(`Successfully upgraded ${email} to ${plan}!`);
  console.log(subscription);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
