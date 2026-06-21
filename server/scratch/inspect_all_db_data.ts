import { Client } from 'pg';

const username = 'postgres.mzvxrfiqkrasdgzejben';
const password = 'f2S2g%.gi/mn%2R';

async function run() {
  const client = new Client({
    host: 'aws-1-ap-northeast-2.pooler.supabase.com',
    port: 6543,
    user: username,
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  
  try {
    await client.connect();
    console.log("Connected to DB successfully!");
    
    // 1. Get counts of LeadCampaign by createdById
    const campaigns = await client.query('SELECT "createdById", COUNT(*)::int as count FROM "LeadCampaign" GROUP BY "createdById"');
    console.log("\n=== LeadCampaign COUNTS BY USER ===");
    console.table(campaigns.rows);

    // 2. Get counts of Leads
    const leadsCount = await client.query('SELECT COUNT(*)::int as count FROM "Lead"');
    console.log(`\nTotal Leads in DB: ${leadsCount.rows[0].count}`);

    // 3. Get counts of Leads by campaign createdById
    const leadsByOwner = await client.query(`
      SELECT lc."createdById", COUNT(l.id)::int as count
      FROM "Lead" l
      LEFT JOIN "LeadCampaign" lc ON l."campaignId" = lc.id
      GROUP BY lc."createdById"
    `);
    console.log("\n=== Lead COUNTS BY CAMPAIGN OWNER ===");
    console.table(leadsByOwner.rows);
    
    // 4. Get all EmailMessages in DB (no limit)
    const messages = await client.query('SELECT id, "organizationId", "sentByUserId", "fromEmail", "toEmail", direction, subject, "createdAt" FROM "EmailMessage" ORDER BY "createdAt" DESC');
    console.log("\n=== ALL EMAIL MESSAGES IN DB ===");
    console.table(messages.rows);

    // 5. Get all EmailThreads in DB
    const threads = await client.query('SELECT id, "organizationId", subject, "createdAt" FROM "EmailThread" ORDER BY "createdAt" DESC');
    console.log("\n=== ALL EMAIL THREADS IN DB ===");
    console.table(threads.rows);
    
    await client.end();
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
