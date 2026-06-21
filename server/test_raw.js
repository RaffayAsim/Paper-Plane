import net from 'net';

const regions = [
  'ap-northeast-2', // Seoul
  'ap-southeast-1', // Singapore
  'ap-northeast-1', // Tokyo
  'us-east-1',      // N. Virginia
  'eu-west-1',      // Ireland
  'us-west-1',      // N. California
  'us-west-2',      // Oregon
  'eu-central-1',   // Frankfurt
  'ap-southeast-2', // Sydney
  'sa-east-1',      // Sao Paulo
  'ap-south-1',     // Mumbai
  'ca-central-1',   // Canada
  'eu-west-2',      // London
  'eu-west-3',      // Paris
];

const projectRef = 'mzvxrfiqkrasdgzejben';
const username = `postgres.${projectRef}`;
const database = 'postgres';

// Build raw PG startup packet
function buildStartupPacket(user, db) {
  const payload = Buffer.concat([
    Buffer.from([0x00, 0x03, 0x00, 0x00]), // Protocol 3.0
    Buffer.from('user\0'),
    Buffer.from(user + '\0'),
    Buffer.from('database\0'),
    Buffer.from(db + '\0'),
    Buffer.from('\0'),
  ]);
  
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeInt32BE(payload.length + 4, 0);
  
  return Buffer.concat([lenBuf, payload]);
}

const packet = buildStartupPacket(username, database);

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(4000);
    
    socket.connect(5432, host, () => {
      socket.write(packet);
    });
    
    socket.on('data', (data) => {
      const type = data.toString('utf8', 0, 1);
      // PG responds with 'R' for Auth Request, or 'E' for ErrorResponse
      if (type === 'R') {
        console.log(`✅ MATCH FOUND! Region: ${region} successfully resolved tenant!`);
        resolve(true);
      } else if (type === 'E') {
        const errorMsg = data.toString('utf8', 5);
        if (errorMsg.includes('tenant/user') && errorMsg.includes('not found')) {
          // Expected not found in wrong regions
        } else {
          console.log(`Region ${region} returned other error:`, errorMsg.substring(0, 150));
        }
        resolve(false);
      } else {
        console.log(`Region ${region} returned unexpected response type:`, type);
        resolve(false);
      }
      socket.destroy();
    });
    
    socket.on('error', (err) => {
      // socket.destroy();
      resolve(false);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function run() {
  console.log("Scanning Supabase regions...");
  for (const region of regions) {
    const success = await testRegion(region);
    if (success) {
      console.log(`Suggested connection string host: aws-0-${region}.pooler.supabase.com`);
      return;
    }
  }
  console.log("Scan complete. No matching region pooler found.");
}

run();
