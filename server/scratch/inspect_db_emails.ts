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
    
    // 1. Get all users
    const users = await client.query('SELECT id, email, "displayName" FROM "User"');
    console.log("\n=== USERS IN DATABASE ===");
    console.table(users.rows);
    
    // 2. Get email message counts
    const messages = await client.query('SELECT id, "organizationId", "sentByUserId", "fromEmail", "toEmail", direction, subject, "createdAt" FROM "EmailMessage" ORDER BY "createdAt" DESC LIMIT 20');
    console.log("\n=== LATEST EMAIL MESSAGES IN DATABASE ===");
    console.table(messages.rows);

    // 3. Get all email accounts configured in settings
    const appSettings = await client.query('SELECT key, scope FROM "AppSetting" WHERE key LIKE \'email.mailbox%\' OR key LIKE \'email.accounts%\' OR key = \'email.configs\'');
    console.log("\n=== EMAIL SETTINGS KEYS IN DATABASE ===");
    console.table(appSettings.rows);

    const emailConfigs = await client.query('SELECT key, value FROM "AppSetting" WHERE key = \'email.configs\'');
    if (emailConfigs.rows.length > 0) {
      console.log("\n=== email.configs VALUE ===");
      console.log(JSON.stringify(emailConfigs.rows[0].value, null, 2));
    }
    
    await client.end();
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
