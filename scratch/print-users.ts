import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      name: true
    }
  });
  console.log('Database users:', JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
