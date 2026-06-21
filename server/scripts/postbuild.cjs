const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src/generated');
const destDir = path.join(__dirname, '../dist/generated');

if (fs.existsSync(srcDir)) {
  fs.cpSync(srcDir, destDir, { recursive: true });
  console.log('[postbuild] Copied generated Prisma client to dist.');
} else {
  console.log('[postbuild] No generated Prisma client found in src.');
}
