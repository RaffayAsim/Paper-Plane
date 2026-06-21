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
    
    // Select subscriptions
    const subs = await client.query('SELECT "userId", "planName", status FROM "Subscription"');
    console.log("Subscriptions in Database:");
    console.log(subs.rows);
    
    await client.end();
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
