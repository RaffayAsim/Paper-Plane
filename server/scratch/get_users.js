import 'dotenv/config';
import { prisma } from '../dist/lib/prisma.js';

async function run() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
      }
    });
    console.log('Users in database:', users);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
