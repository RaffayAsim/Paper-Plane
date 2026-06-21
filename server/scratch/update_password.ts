import bcrypt from "bcryptjs";
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
    
    const hashed = await bcrypt.hash('password123', 12);
    
    // Update zeeshanm@quantumarc.us
    await client.query('UPDATE "User" SET "passwordHash" = $1 WHERE email = $2', [hashed, 'zeeshanm@quantumarc.us']);
    console.log("Password for zeeshanm@quantumarc.us updated to password123");

    // Update abdul.raffay@quantumarc.us
    await client.query('UPDATE "User" SET "passwordHash" = $1 WHERE email = $2', [hashed, 'abdul.raffay@quantumarc.us']);
    console.log("Password for abdul.raffay@quantumarc.us updated to password123");
    
    await client.end();
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
