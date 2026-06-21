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
    
    // 1. Get the email.smtp.configs
    const configs = await client.query('SELECT key, value FROM "AppSetting" WHERE key = $1', ['email.smtp.configs']);
    if (configs.rows.length > 0) {
      console.log("\n=== email.smtp.configs VALUE ===");
      console.log(JSON.stringify(configs.rows[0].value, null, 2));
    } else {
      console.log("No email.smtp.configs found in AppSetting!");
    }

    // 2. Get all rows in AppSetting
    const allSettings = await client.query('SELECT key, scope FROM "AppSetting"');
    console.log("\n=== ALL APP SETTING KEYS ===");
    console.table(allSettings.rows);

    // 3. Get all inboundMailboxSync rows
    const syncs = await client.query('SELECT * FROM "InboundMailboxSync"');
    console.log("\n=== INBOUND MAILBOX SYNC STATUS ===");
    console.table(syncs.rows);
    
    await client.end();
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
