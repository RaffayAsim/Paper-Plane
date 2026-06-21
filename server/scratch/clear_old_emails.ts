/**
 * Clears ALL emailMessage and emailThread records from the local database.
 */

import { prisma } from "../src/lib/prisma.js";

async function clearOldEmails() {
  console.log("=== Clearing Old Email Data ===\n");

  // Count before
  const msgCount = await prisma.emailMessage.count();
  const threadCount = await prisma.emailThread.count();
  console.log(`Before: ${msgCount} messages, ${threadCount} threads`);

  // Delete all messages first (FK references threads)
  const deletedMessages = await prisma.emailMessage.deleteMany({});
  console.log(`✅ Deleted ${deletedMessages.count} emailMessage records`);

  // Delete all threads
  const deletedThreads = await prisma.emailThread.deleteMany({});
  console.log(`✅ Deleted ${deletedThreads.count} emailThread records`);

  // Verify cleanup
  const msgCountAfter = await prisma.emailMessage.count();
  const threadCountAfter = await prisma.emailThread.count();
  console.log(`\nAfter: ${msgCountAfter} messages, ${threadCountAfter} threads`);
  console.log("\n✅ Inbox is now clean — only new emails will appear from here.");

  await prisma.$disconnect();
}

clearOldEmails().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
