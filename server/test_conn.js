import { Client } from 'pg';

const regions = [
  'ap-northeast-2', // Seoul
  'ap-southeast-1', // Singapore
  'ap-northeast-1', // Tokyo
  'us-east-1',      // N. Virginia
  'eu-west-1',      // Ireland
];

const username = 'postgres.mzvxrfiqkrasdgzejben';
const password = 'f2S2g%.gi/mn%2R'; // Raw password for PG client

async function testRegions() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    console.log(`Testing connection to ${region} pooler (${host})...`);
    
    const client = new Client({
      host,
      port: 6543,
      user: username,
      password: password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    
    try {
      await client.connect();
      console.log(`✅ SUCCESS! Connected to Supabase via ${region} pooler!`);
      const res = await client.query('SELECT version()');
      console.log('Version:', res.rows[0].version);
      await client.end();
      return;
    } catch (err) {
      console.log(`❌ FAILED for ${region}:`, err.message);
    }
  }
}

testRegions();
