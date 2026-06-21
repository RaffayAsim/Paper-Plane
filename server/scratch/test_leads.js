import 'dotenv/config';
import { prisma } from '../dist/lib/prisma.js';

async function run() {
  try {
    const totalLeads = await prisma.lead.count();
    console.log('Total leads in database:', totalLeads);

    const incomingMessages = await prisma.emailMessage.findMany({
      where: {
        direction: 'incoming',
      },
      select: {
        fromEmail: true,
      },
    });
    console.log('Total incoming email messages:', incomingMessages.length);

    const respondedEmails = [...new Set(incomingMessages.map((m) => m.fromEmail.trim().toLowerCase()).filter(Boolean))];
    console.log('Unique responder emails count:', respondedEmails.length);
    console.log('Unique responder emails:', respondedEmails);

    const engagedLeadsCount = await prisma.lead.count({
      where: {
        OR: [
          { email: { in: respondedEmails } },
          { status: { in: ['qualified', 'converted'] } }
        ]
      }
    });
    console.log('Count of engaged leads (responded/qualified/converted):', engagedLeadsCount);

    const sampleEngaged = await prisma.lead.findMany({
      where: {
        OR: [
          { email: { in: respondedEmails } },
          { status: { in: ['qualified', 'converted'] } }
        ]
      },
      take: 5
    });
    console.log('Sample engaged leads:', sampleEngaged.map(l => ({ name: l.name, email: l.email, status: l.status })));

  } catch (error) {
    console.error('Error running test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
