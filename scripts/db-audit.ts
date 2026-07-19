/**
 * Database Statistics & Migration Audit Script
 * Run from project root: npx tsx scripts/db-audit.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('📊 === DATABASE AUDIT REPORT ===\n');

  // 1. Basic counts
  const usersCount = await prisma.user.count();
  const adsCount = await prisma.ad.count();
  const adImagesCount = await prisma.adImage.count();
  const commentsCount = await prisma.comment.count();
  const sessionsCount = await prisma.session.count();
  const notificationsCount = await prisma.notification.count();

  console.log('--- ENTITY COUNTS ---');
  console.log(`Users:         ${usersCount}`);
  console.log(`Ads:           ${adsCount}`);
  console.log(`Ad Images:     ${adImagesCount}`);
  console.log(`Comments:      ${commentsCount}`);
  console.log(`Sessions:      ${sessionsCount}`);
  console.log(`Notifications: ${notificationsCount}`);

  // 2. Storage URL distribution
  console.log('\n--- STORAGE URL DISTRIBUTION ---');
  const localAvatars = await prisma.user.count({ where: { avatar: { startsWith: '/uploads/' } } });
  const cloudAvatars  = await prisma.user.count({ where: { avatar: { startsWith: 'http' } } });
  const nullAvatars   = await prisma.user.count({ where: { avatar: null } });
  const localAdImages = await prisma.adImage.count({ where: { url: { startsWith: '/uploads/' } } });
  const cloudAdImages = await prisma.adImage.count({ where: { url: { startsWith: 'http' } } });

  console.log(`User Avatars  - Local: ${localAvatars} | Cloud: ${cloudAvatars} | None: ${nullAvatars}`);
  console.log(`Ad Images     - Local: ${localAdImages} | Cloud: ${cloudAdImages}`);

  // 3. Database size
  console.log('\n--- DATABASE SIZE ---');
  const dbSizeRes: any[] = await prisma.$queryRawUnsafe(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS total_size;`
  );
  console.log(`Total DB Size: ${dbSizeRes[0]?.total_size}`);

  // 4. Table sizes
  console.log('\n--- TABLE SIZES (top 10) ---');
  const tableSizes: any[] = await prisma.$queryRawUnsafe(`
    SELECT relname AS table_name,
           pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
           pg_size_pretty(pg_relation_size(relid)) AS data_size
    FROM pg_catalog.pg_statio_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 10;
  `);
  tableSizes.forEach(t => {
    console.log(`  ${t.table_name.padEnd(30)} total: ${String(t.total_size).padEnd(12)} data: ${t.data_size}`);
  });

  // 5. Indexes
  console.log('\n--- INDEXES ---');
  const indexes: any[] = await prisma.$queryRawUnsafe(`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);
  indexes.forEach(idx => {
    console.log(`  ${idx.tablename.padEnd(25)} -> ${idx.indexname}`);
  });

  // 6. Sample local URLs for manual verification
  console.log('\n--- SAMPLE LOCAL AD IMAGE URLs (if any) ---');
  const sampleLocalImgs = await prisma.adImage.findMany({
    where: { url: { startsWith: '/uploads/' } },
    take: 5,
    select: { id: true, url: true, adId: true }
  });
  if (sampleLocalImgs.length === 0) {
    console.log('  ✅ No local ad image URLs found.');
  } else {
    sampleLocalImgs.forEach(img => console.log(`  ⚠️  AdImage[${img.id}]: ${img.url}`));
  }

  // 7. Sample local avatars
  console.log('\n--- SAMPLE LOCAL AVATAR URLs (if any) ---');
  const sampleLocalAvatars = await prisma.user.findMany({
    where: { avatar: { startsWith: '/uploads/' } },
    take: 5,
    select: { id: true, email: true, avatar: true }
  });
  if (sampleLocalAvatars.length === 0) {
    console.log('  ✅ No local avatar URLs found.');
  } else {
    sampleLocalAvatars.forEach(u => console.log(`  ⚠️  User[${u.email}]: ${u.avatar}`));
  }

  console.log('\n✅ Database audit complete.\n');
}

main()
  .catch(err => { console.error('Fatal error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
