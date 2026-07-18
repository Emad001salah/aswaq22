import { prisma } from '../src/lib/prisma.ts';

async function run() {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        nameAr: true,
        nameEn: true
      }
    });
    console.log('--- Database Categories ---');
    console.log(JSON.stringify(categories, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
