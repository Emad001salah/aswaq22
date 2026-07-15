import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emails = ['emad001salah@gmail.com', 'eee3327@gmail.com'];

  console.log('--- Database Admin Role Update to ADMIN ---');

  for (const email of emails) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      console.log(`Found user: ${user.name} (${user.email}), current role: ${user.role}`);
      
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.ADMIN }, // Set strictly to ADMIN (becomes 'admin' in client check)
      });

      console.log(`Updated user ${updated.email} to role: ${updated.role}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error running admin update:', e);
});
