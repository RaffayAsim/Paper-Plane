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
    
    // Select user by email
    const userRes = await client.query('SELECT id, email, "displayName" FROM "User" WHERE email = $1', ['admin@example.com']);
    console.log("User:", userRes.rows);
    
    if (userRes.rows.length > 0) {
      const userId = userRes.rows[0].id;
      // Select subscriptions
      const subs = await client.query('SELECT "planName", status FROM "Subscription" WHERE "userId" = $1', [userId]);
      console.log("Subscriptions:", subs.rows);
    }
    
    await client.end();
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
