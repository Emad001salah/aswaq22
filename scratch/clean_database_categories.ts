import { prisma } from '../src/lib/prisma.ts';

async function cleanCategories() {
  console.log('--- Cleaning Duplicate and General Categories ---');

  // 1. Merge "سيارات" (1f58b1e9-65af-4512-aac8-3fca0a4daff7) into "سيارات ومركبات" (e66a124f-9cab-d319-8d84-dd68c8c87cf7)
  const oldCars = await prisma.category.findFirst({ where: { nameAr: 'سيارات' } });
  const targetCars = await prisma.category.findFirst({ where: { nameAr: 'سيارات ومركبات' } });

  if (oldCars && targetCars) {
    console.log(`Reassigning ads from "${oldCars.nameAr}" (${oldCars.id}) to "${targetCars.nameAr}" (${targetCars.id})...`);
    await prisma.ad.updateMany({
      where: { categoryId: oldCars.id },
      data: { categoryId: targetCars.id }
    });
    await prisma.subCategory.updateMany({
      where: { categoryId: oldCars.id },
      data: { categoryId: targetCars.id }
    });
    await prisma.category.delete({ where: { id: oldCars.id } });
    console.log('Successfully deleted duplicate "سيارات" category.');
  }

  // 2. Merge "إلكترونيات" (a848a87f-ec45-4f1f-a1a3-17ff1fab6b24) into "إلكترونيات وأجهزة منزلية" (9ca91fd2-ee5f-4b46-3d11-404b9c84803c)
  const oldElectronics = await prisma.category.findFirst({ where: { nameAr: 'إلكترونيات' } });
  const targetElectronics = await prisma.category.findFirst({ where: { nameAr: 'إلكترونيات وأجهزة منزلية' } });

  if (oldElectronics && targetElectronics) {
    console.log(`Reassigning ads from "${oldElectronics.nameAr}" (${oldElectronics.id}) to "${targetElectronics.nameAr}" (${targetElectronics.id})...`);
    await prisma.ad.updateMany({
      where: { categoryId: oldElectronics.id },
      data: { categoryId: targetElectronics.id }
    });
    await prisma.subCategory.updateMany({
      where: { categoryId: oldElectronics.id },
      data: { categoryId: targetElectronics.id }
    });
    await prisma.category.delete({ where: { id: oldElectronics.id } });
    console.log('Successfully deleted duplicate "إلكترونيات" category.');
  }

  // 3. Remove "عام" (General) category (0feae16d-5536-4acf-a7fe-9f909834361b)
  const generalCat = await prisma.category.findFirst({ where: { OR: [{ nameAr: 'عام' }, { nameEn: 'General' }] } });
  const otherCat = await prisma.category.findFirst({ where: { nameAr: { contains: 'أخرى' } } });

  if (generalCat) {
    if (otherCat) {
      console.log(`Reassigning ads from "${generalCat.nameAr}" to "${otherCat.nameAr}"...`);
      await prisma.ad.updateMany({
        where: { categoryId: generalCat.id },
        data: { categoryId: otherCat.id }
      });
      await prisma.subCategory.updateMany({
        where: { categoryId: generalCat.id },
        data: { categoryId: otherCat.id }
      });
    }
    await prisma.category.delete({ where: { id: generalCat.id } });
    console.log('Successfully deleted "عام" (General) category.');
  }

  const remaining = await prisma.category.findMany();
  console.log('Remaining Categories Count:', remaining.length);
  remaining.forEach(c => console.log(`- ${c.nameAr} (${c.nameEn})`));
}

cleanCategories()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
