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
    
    // 1. Delete all EmailMessage records
    const deleteMsgs = await client.query('DELETE FROM "EmailMessage"');
    console.log(`Deleted ${deleteMsgs.rowCount} messages.`);

    // 2. Delete all EmailThread records
    const deleteThreads = await client.query('DELETE FROM "EmailThread"');
    console.log(`Deleted ${deleteThreads.rowCount} threads.`);

    // 3. Reset InboundMailboxSync lastUid to null
    const resetSync = await client.query('UPDATE "InboundMailboxSync" SET "lastUid" = NULL');
    console.log(`Reset ${resetSync.rowCount} mailbox sync state UIDs to NULL.`);
    
    await client.end();
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
