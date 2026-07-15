import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'] } },
    select: { id: true, email: true, name: true, role: true }
  });
  console.log('Admin users:', JSON.stringify(admins, null, 2));
  
  const totalUsers = await prisma.user.count();
  console.log('Total users:', totalUsers);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
