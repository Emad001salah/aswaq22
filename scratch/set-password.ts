import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('12345678', salt);
  
  const user = await prisma.user.update({
    where: { email: 'eee3327@gmail.com' },
    data: { password: hash }
  });
  
  console.log('Successfully set password to 12345678 for:', user.email);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
