import http from 'http';

const BASE_URL = 'http://127.0.0.1:4000/api';

function login() {
  return new Promise<string>((resolve, reject) => {
    const payload = JSON.stringify({ email: 'admin@example.com', password: 'change-me-now' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const body = JSON.parse(data);
        resolve(body.accessToken);
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  const token = await login();
  console.log("Logged in!");

  const start = Date.now();
  http.get('http://127.0.0.1:4000/api/leads/meta/dashboard', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      const elapsed = Date.now() - start;
      console.log(`Status: ${res.statusCode}`);
      console.log(`Response Size: ${data.length} bytes`);
      console.log(`Elapsed Time: ${elapsed} ms`);
    });
  }).on('error', (err) => {
    console.error('Error:', err.message);
  });
}

run().catch(console.error);
