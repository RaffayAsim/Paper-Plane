import { Client } from 'pg';

const username = 'postgres.mzvxrfiqkrasdgzejben';
const password = 'f2S2g%.gi/mn%2R';

const planArg = process.argv[2];
if (planArg !== 'base' && planArg !== 'ai_lead_gen') {
  console.error("Please specify plan: base or ai_lead_gen");
  process.exit(1);
}

const targetStatus = planArg === 'base' ? 'canceled' : 'active';

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
    
    // Get user by email
    const userRes = await client.query('SELECT id FROM "User" WHERE email = $1', ['admin@example.com']);
    if (userRes.rows.length === 0) {
      console.error("Admin user not found.");
      await client.end();
      return;
    }
    const userId = userRes.rows[0].id;
    
    // Update subscription status
    await client.query('UPDATE "Subscription" SET status = $1 WHERE "userId" = $2', [targetStatus, userId]);
    console.log(`Successfully switched admin@example.com subscription status to: ${targetStatus} (matches plan: ${planArg})`);
    
    await client.end();
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
