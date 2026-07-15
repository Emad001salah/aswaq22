import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const emails = ['eee3327@gmail.com', 'emad001salah@gmail.com'];
  try {
    for (const email of emails) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.user.update({
          where: { email },
          data: { role: 'SUPER_ADMIN' } // Assuming role is enum 'SUPER_ADMIN' or similar
        });
        console.log(`Updated ${email} to SUPER_ADMIN`);
      } else {
        console.log(`User ${email} not found. Creating it? Or just logging...`);
      }
    }
    
    // Also, print all current admins
    const admins = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } }
    });
    console.log("Current admins in DB:", admins.map(a => `${a.email} (${a.role})`));
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
