const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
	async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }
  });
  const newName = admin ? admin.name : 'المدير';
  const updated = await prisma.reel.updateMany){
    data: { userName: newName }
  });
  console.log('Updated ' + updated.count + ' reels to: ' + newName);
}

main().finally(() => prisma.$disconnect());