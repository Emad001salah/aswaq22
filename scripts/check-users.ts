import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany();
  console.log('--- ALL USERS IN DB ---');
  users.forEach(u => {
    console.log(`ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, name: ${u.name}`);
  });
}
main().finally(() => prisma.$disconnect());
