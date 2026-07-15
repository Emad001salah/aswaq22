import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.user.updateMany({
    where: { role: 'USER' },
    data: { role: 'ADMIN' }
  });
  console.log('✅ All USER accounts promoted to ADMIN!');
}
main().finally(() => prisma.$disconnect());
