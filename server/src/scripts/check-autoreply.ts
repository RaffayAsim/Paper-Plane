import { prisma } from "../lib/prisma.js";
import { getSmtpConfigs } from "../lib/email-settings.js";

async function run() {
  console.log("==================================================");
  console.log("AI AUTO-REPLY CONFIGURATION DIAGNOSTICS");
  console.log("==================================================");

  // 1. Check Mailbox Configs
  try {
    const configs = await getSmtpConfigs();
    console.log(`\n1. Mailbox Configurations (Total: ${configs.length}):`);
    for (const config of configs) {
      console.log(`- Mailbox Name: "${config.name}"`);
      console.log(`  Email: ${config.fromEmail}`);
      console.log(`  Active: ${config.isActive}`);
      console.log(`  Assigned User: ${config.assignedUserId || "None"}`);
      console.log(`  IMAP Host: ${config.imapHost || "Not Configured"}`);
      console.log(`  IMAP User: ${config.imapUser || "Not Configured"}`);
      console.log(`  IMAP Password Configured: ${config.imapPass ? "Yes" : "No"}`);
      console.log(`  SMTP Host: ${config.host}:${config.port} (SSL: ${config.secure})`);
    }
  } catch (error) {
    console.error("Error reading SMTP configs:", error);
  }

  // 2. Check Inbound Mailbox Sync Status
  try {
    const syncs = await prisma.inboundMailboxSync.findMany();
    console.log(`\n2. Inbound Mailbox Sync Statuses (Total: ${syncs.length}):`);
    for (const sync of syncs) {
      console.log(`- Mailbox ID: ${sync.id}`);
      console.log(`  Status: ${sync.status}`);
      console.log(`  Last Run: ${sync.lastRunAt || "Never"}`);
      console.log(`  Last UID: ${sync.lastUid || "None"}`);
      console.log(`  Last Error: ${sync.lastError || "None"}`);
    }
  } catch (error) {
    console.error("Error reading sync statuses:", error);
  }

  // 3. Check AI Brand Profiles
  try {
    const brandProfiles = await prisma.appSetting.findMany({
      where: {
        OR: [
          { key: { startsWith: "user.brand." } },
          { key: { startsWith: "user.ai_brand_profile." } },
        ],
      },
    });
    console.log(`\n3. AI Brand Profiles (Total: ${brandProfiles.length}):`);
    for (const profile of brandProfiles) {
      console.log(`- Key: ${profile.key}`);
      const value = profile.value as any;
      console.log(`  Auto Reply Enabled: ${value?.autoReplyEnabled}`);
      console.log(`  Company: ${value?.brandName || value?.companyName || "None"}`);
      console.log(`  Tone: ${value?.brandGuidelines || value?.tone || "None"}`);
    }
  } catch (error) {
    console.error("Error reading brand profiles:", error);
  }

  // 4. Check Recent Email Messages
  try {
    const recentEmails = await prisma.emailMessage.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    });
    console.log(`\n4. Recent Email Messages (Total in DB: ${await prisma.emailMessage.count()}):`);
    for (const email of recentEmails) {
      console.log(`- Message [${email.direction}]: ${email.fromEmail} -> ${email.toEmail}`);
      console.log(`  Subject: "${email.subject}"`);
      console.log(`  Thread ID: ${email.threadId}`);
      console.log(`  Date: ${email.createdAt.toISOString()}`);
    }
  } catch (error) {
    console.error("Error reading recent emails:", error);
  }

  console.log("\n==================================================");
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
