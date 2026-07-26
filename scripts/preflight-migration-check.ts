import { prisma } from '../src/lib/prisma.ts';

/**
 * STRICT READ-ONLY PREFLIGHT AUDIT
 * Strictly verifies schema readiness and data integrity before running `prisma migrate deploy`.
 * Does NOT mutate or touch any existing production data.
 * Exits with status 1 if any conflict is detected.
 */
async function main() {
  console.log('[Preflight] Running strict read-only audit before database migration...');
  let hasConflicts = false;

  // 1. Check for multiple primary images per ad
  const multiplePrimary: any[] = await prisma.$queryRaw`
    SELECT ad_id, COUNT(*) AS primary_count
    FROM ad_images
    WHERE is_primary = true
    GROUP BY ad_id
    HAVING COUNT(*) > 1;
  `;

  if (multiplePrimary.length > 0) {
    console.error(`[Preflight ERROR] Found ${multiplePrimary.length} ads with multiple primary images!`);
    console.error(multiplePrimary);
    hasConflicts = true;
  } else {
    console.log('[Preflight PASS] No ads have multiple primary images.');
  }

  // 2. Check for ads with images but no primary image set
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

  if (missingPrimary.length > 0) {
    console.error(`[Preflight ERROR] Found ${missingPrimary.length} ads with images missing a primary image assignment!`);
    console.error(missingPrimary);
    hasConflicts = true;
  } else {
    console.log('[Preflight PASS] All ads with images have a primary image assigned.');
  }

  // 3. Check for duplicate sort orders per ad
  const duplicateSortOrder: any[] = await prisma.$queryRaw`
    SELECT ad_id, sort_order, COUNT(*) AS count
    FROM ad_images
    GROUP BY ad_id, sort_order
    HAVING COUNT(*) > 1;
  `;

  if (duplicateSortOrder.length > 0) {
    console.error(`[Preflight ERROR] Found ${duplicateSortOrder.length} instances of duplicate sort_order per ad!`);
    console.error(duplicateSortOrder);
    hasConflicts = true;
  } else {
    console.log('[Preflight PASS] Image sort orders are unique per ad.');
  }

  if (hasConflicts) {
    console.error('[Preflight FAILED] Database contains data integrity conflicts. Migration aborted.');
    process.exit(1);
  }

  console.log('[Preflight SUCCESS] All pre-migration checks passed cleanly. Safe to run npx prisma migrate deploy.');
  process.exit(0);
}

main().catch((e) => {
  console.error('[Preflight ERROR] Unexpected error during preflight check:', e);
  process.exit(1);
});
