import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";

function getDatabaseSummary() {
  const url = new URL(config.DATABASE_URL);

  return {
    host: url.hostname,
    port: url.port || "3306",
    database: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username || ""),
  };
}

async function run() {
  const db = getDatabaseSummary();

  console.log("Testing database connection...");
  console.log(`Host: ${db.host}`);
  console.log(`Port: ${db.port}`);
  console.log(`Database: ${db.database}`);
  console.log(`User: ${db.user || "(empty)"}`);

  const result = await prisma.$queryRaw<Array<{ ok: unknown }>>`SELECT 1 AS ok`;
  const rawOk = Array.isArray(result) ? result[0]?.ok : null;
  const ok = rawOk === 1 || rawOk === 1n || rawOk === "1";

  if (!ok) {
    throw new Error("Database query succeeded but returned an unexpected result");
  }

  console.log("Database connection successful.");
}

run()
  .catch((error) => {
    console.error("Database connection failed.");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
