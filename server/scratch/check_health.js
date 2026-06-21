import http from 'http';

http.get('http://127.0.0.1:4000/api/health', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${data}`);
  });
}).on('error', (err) => {
  console.error('Full Error:', err);
});
