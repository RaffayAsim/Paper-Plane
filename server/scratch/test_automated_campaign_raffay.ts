import http from 'http';

const BASE_URL = 'http://localhost:4000/api';

function request(method: string, path: string, body: any = null, token: string | null = null) {
  return new Promise<{ status: number, body: any }>((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 0, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== LOGGING IN AS ADMIN ===');
  const loginRes = await request('POST', '/auth/login', {
    email: 'admin@example.com',
    password: 'change-me-now',
  });
  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  }
  const token = loginRes.body.accessToken;
  console.log('✅ Logged in successfully!');

  console.log('\n=== IMPORTING LEAD WITH METADATA FOR RAFFAY ===');
  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`Today's date is: ${todayStr}`);

  const importPayload = {
    campaignName: 'Raffay Automated Test Scrape',
    leads: [
      {
        name: 'Abdul Raffay',
        email: 'raffay.asim6@gmail.com',
        contractRenewalDate: todayStr
      }
    ]
  };

  const importRes = await request('POST', '/leads/campaigns/import', importPayload, token);
  if (importRes.status !== 201) {
    throw new Error(`Import failed: ${importRes.status} - ${JSON.stringify(importRes.body)}`);
  }
  const leadId = importRes.body.leadIds[0];
  console.log(`✅ Imported lead ID: ${leadId}`);

  console.log('\n=== LAUNCHING AUTOMATED CAMPAIGN ===');
  const campaignPayload = {
    leadIds: [leadId],
    campaignType: 'automated',
    subjectTemplate: 'Contract Renewal Alert for {{name}}',
    bodyTemplate: 'Hi {{name}},\n\nThis is an automated event reminder for your contract. Your renewal date is today ({{contractRenewalDate}}).\n\nPlease let us know if you have any questions.\n\nBest,\nEmailPulse Team',
    triggerRule: {
      dateFieldKey: 'contractRenewalDate',
      daysOffset: 0,
      timingType: 'on'
    }
  };

  const campaignRes = await request('POST', '/leads/message-campaigns', campaignPayload, token);
  if (campaignRes.status !== 201) {
    throw new Error(`Campaign launch failed: ${campaignRes.status} - ${JSON.stringify(campaignRes.body)}`);
  }
  const campaignId = campaignRes.body.item.id;
  console.log(`✅ Launched campaign ID: ${campaignId}`);

  console.log('\n=== TRIGGERING CAMPAIGN SCAN (INBOX SYNC) ===');
  const syncRes = await request('POST', '/emails/sync', {}, token);
  console.log(`Sync status: ${syncRes.status}, response:`, JSON.stringify(syncRes.body));

  console.log('\n=== WAITING 8 SECONDS FOR PROCESSING ===');
  await new Promise(resolve => setTimeout(resolve, 8000));

  console.log('\n=== CHECKING CAMPAIGN STATUS ===');
  const checkRes = await request('GET', `/leads/message-campaigns/${campaignId}`, null, token);
  if (checkRes.status !== 200) {
    console.error(`Failed to get campaign: ${checkRes.status}`, checkRes.body);
  } else {
    console.log('Campaign details:', JSON.stringify(checkRes.body.item, null, 2));
  }
}

run().catch(console.error);
