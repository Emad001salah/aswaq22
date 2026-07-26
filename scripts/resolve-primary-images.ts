import { prisma } from '../src/lib/prisma.ts';

/**
 * Data resolution script: Sets is_primary = true for the first image (by sort_order)
 * for any existing ad that has images but currently lacks a primary image.
 */
async function main() {
  console.log('[Data Repair] Resolving primary image assignments for existing ads...');

  const missingPrimary: any[] = await prisma.$queryRaw`
    SELECT a.id
    FROM ads a
    WHERE EXISTS (
      SELECT 1 FROM ad_images ai WHERE ai.ad_id = a.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM ad_images ai WHERE ai.ad_id = a.id AND ai.is_primary = true
    );
  `;

  console.log(`[Data Repair] Found ${missingPrimary.length} ads missing a primary image.`);

  let updatedCount = 0;
  for (const row of missingPrimary) {
    const firstImg = await prisma.adImage.findFirst({
      where: { adId: row.id },
      orderBy: { sortOrder: 'asc' },
    });

    if (firstImg) {
      await prisma.adImage.update({
        where: { id: firstImg.id },
        data: { isPrimary: true },
      });
      updatedCount++;
    }
  }

  console.log(`[Data Repair] Successfully assigned primary image to ${updatedCount} ads.`);
}

main()
  .catch((e) => {
    console.error('[Data Repair] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
