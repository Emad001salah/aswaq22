import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: {
      role: {
        in: ['ADMIN', 'SUPER_ADMIN']
      }
    }
  });
  console.log('Admins found:', admins.map(u => ({ id: u.id, email: u.email, role: u.role, name: u.name })));
}

main().catch(err => {
  console.error(err);
});
