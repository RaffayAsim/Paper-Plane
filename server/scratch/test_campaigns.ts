import https from 'https';
import http from 'http';

const BASE_URL = 'http://localhost:4000/api';

// Simple HTTP/HTTPS request wrapper
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
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
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function loginAdmin() {
  console.log('\n=== ADMIN LOGIN ===');
  const res = await request('POST', '/auth/login', {
    email: 'admin@example.com',
    password: 'change-me-now',
  });
  if (res.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  }
  const token = res.body.accessToken;
  const user = res.body.user;
  console.log(`✅ Logged in as: ${user.email} (plan: ${user.subscriptionPlan})`);
  return token;
}

async function getCurrentUser(token) {
  console.log('\n=== CURRENT USER / PLAN ===');
  const res = await request('GET', '/auth/me', null, token);
  if (res.status !== 200) {
    console.log('❌ Could not fetch user profile:', res.body);
    return null;
  }
  const plan = res.body.user?.subscriptionPlan || res.body.subscriptionPlan || 'unknown';
  console.log(`✅ Current plan: ${plan}`);
  console.log('   User data:', JSON.stringify(res.body, null, 2).substring(0, 400));
  return res.body;
}

async function getUsage(token) {
  console.log('\n=== USAGE / SENT COUNT ===');
  const res = await request('GET', '/billing/usage', null, token);
  if (res.status !== 200) {
    console.log('❌ Could not fetch usage:', res.status, res.body);
    return;
  }
  console.log(`✅ Sent count: ${res.body.sentCount}`);
}

async function getEmailAccounts(token) {
  console.log('\n=== EMAIL ACCOUNTS (SMTP/IMAP) ===');
  const res = await request('GET', '/settings/email-accounts', null, token);
  if (res.status !== 200) {
    console.log('❌ Could not fetch email accounts:', res.status, res.body);
    return [];
  }
  const accounts = res.body.items || [];
  console.log(`✅ Found ${accounts.length} email account(s)`);
  accounts.forEach(a => {
    console.log(`   - ${a.email} | active: ${a.isActive} | daily limit: ${a.dailySendLimit}`);
  });
  return accounts;
}

async function getLeads(token) {
  console.log('\n=== EXISTING LEADS ===');
  const res = await request('GET', '/leads?limit=10', null, token);
  if (res.status !== 200) {
    console.log('❌ Could not fetch leads:', res.status, res.body);
    return [];
  }
  const leads = res.body.items || res.body.leads || [];
  console.log(`✅ Found ${leads.length} lead(s)`);
  leads.slice(0, 3).forEach(l => {
    console.log(`   - "${l.name}" <${l.email}> (status: ${l.status})`);
  });
  return leads;
}

async function createSampleLead(token) {
  console.log('\n=== CREATING SAMPLE TEST LEAD ===');
  const res = await request('POST', '/leads', {
    name: 'Test Lead (EmailPulse)',
    business: 'Test Company Inc.',
    email: 'testlead@example.com',
    phone: '+1-555-0000',
    location: 'New York, NY',
    source: 'custom',
    status: 'new',
  }, token);
  if (res.status !== 200 && res.status !== 201) {
    console.log('❌ Could not create lead:', res.status, JSON.stringify(res.body).substring(0, 200));
    return null;
  }
  const lead = res.body.lead || res.body;
  console.log(`✅ Created lead: "${lead.name}" (id: ${lead.id})`);
  return lead;
}

async function testCustomCampaign(token, leadIds) {
  console.log('\n=== TEST 1: CUSTOM CAMPAIGN (manual) ===');
  console.log('   (This is available on both base and ai_lead_gen plans)');
  
  const payload = {
    leadIds,
    campaignType: 'manual',
    subjectTemplate: 'Hello {{name}} - Test Campaign',
    bodyTemplate: 'Hi {{name}},\n\nThis is a test email from EmailPulse Custom Campaign.\n\nBest regards,\nEmailPulse Team',
    pitch: '',
    triggerRule: undefined,
    scheduledAt: undefined,
  };

  const res = await request('POST', '/leads/launch-campaign', payload, token);
  
  if (res.status >= 400) {
    console.log(`❌ Custom campaign failed (${res.status}):`, JSON.stringify(res.body).substring(0, 300));
    return false;
  }
  console.log(`✅ Custom campaign launched! Status: ${res.status}`);
  console.log('   Response:', JSON.stringify(res.body).substring(0, 300));
  return true;
}

async function testAiCampaign(token, leadIds) {
  console.log('\n=== TEST 2: AI OUTREACH CAMPAIGN ===');
  console.log('   (Should only work on ai_lead_gen plan)');
  
  const payload = {
    leadIds,
    campaignType: 'ai',
    subjectTemplate: '',
    bodyTemplate: '',
    pitch: 'We help businesses automate their email outreach with AI-powered personalization.',
    triggerRule: undefined,
    scheduledAt: undefined,
  };

  const res = await request('POST', '/leads/launch-campaign', payload, token);
  
  if (res.status >= 400) {
    console.log(`⚠️  AI campaign blocked (${res.status}):`, JSON.stringify(res.body).substring(0, 300));
    return false;
  }
  console.log(`✅ AI campaign launched! Status: ${res.status}`);
  console.log('   Response:', JSON.stringify(res.body).substring(0, 300));
  return true;
}

async function testEmailLimit(token) {
  console.log('\n=== FREE TRIAL LIMIT TEST ===');
  const res = await request('GET', '/billing/usage', null, token);
  if (res.status === 200) {
    const sent = res.body.sentCount;
    console.log(`✅ Emails sent so far: ${sent} / 20 (Free Trial limit)`);
    if (sent >= 20) {
      console.log('⚠️  Free Trial email limit REACHED — outreach should be blocked');
    } else {
      console.log(`   Remaining: ${20 - sent} emails on Free Trial`);
    }
  } else {
    console.log(`❌ Could not check usage: ${res.status}`, res.body);
  }
}

async function runAllTests() {
  console.log('============================================================');
  console.log('       EMAILPULSE CAMPAIGN LOGIC TESTING SCRIPT');
  console.log('============================================================');

  let token;
  try {
    token = await loginAdmin();
  } catch (err) {
    console.error('FATAL: Cannot login.', err.message);
    return;
  }

  // Get user profile to check current plan
  await getCurrentUser(token);

  // Check email accounts
  await getEmailAccounts(token);

  // Check usage
  await getUsage(token);

  // Get existing leads
  let leads = await getLeads(token);
  
  // Create a test lead if none exist
  let testLead;
  if (leads.length === 0) {
    testLead = await createSampleLead(token);
  } else {
    testLead = leads[0];
    console.log(`\n   Using existing lead: "${testLead.name}" (${testLead.id})`);
  }

  if (!testLead) {
    console.log('\n❌ No leads available. Cannot test campaigns.');
    return;
  }

  const leadIds = [testLead.id];

  // --- TEST CUSTOM CAMPAIGN (manual) ---
  await testCustomCampaign(token, leadIds);

  // --- TEST AI CAMPAIGN ---
  await testAiCampaign(token, leadIds);

  // --- FREE TRIAL LIMIT ---
  await testEmailLimit(token);

  console.log('\n============================================================');
  console.log('                    TESTING COMPLETE');
  console.log('============================================================');
}

runAllTests().catch(console.error);
