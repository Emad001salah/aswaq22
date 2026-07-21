import { prisma } from '../src/lib/prisma.ts';

async function checkCategories() {
  const categories = await prisma.category.findMany();
  console.log('Database Categories Total:', categories.length);
  categories.forEach(c => {
    console.log(`ID: ${c.id} | nameAr: "${c.nameAr}" | nameEn: "${c.nameEn}"`);
  });
}

checkCategories().catch(console.error).finally(() => prisma.$disconnect());
