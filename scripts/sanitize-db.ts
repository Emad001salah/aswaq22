import { PrismaClient, UserRole } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`🧪 Starting Aswaq Database Production Sanitization (Sprint 7.8) [Dry Run: ${dryRun}]...`);

  // 1. Check target counts first
  const admins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN },
  });
  console.log(`🔑 Found ${admins.length} Admin users to preserve.`);

  const outboxCount = await prisma.outboxEvent.count();
  const analyticsCount = await prisma.analyticsEvent.count();
  const securityEventCount = await prisma.securityEvent.count();
  const adminLogCount = await prisma.adminLog.count();
  const betaInviteCount = await prisma.betaInvitation.count();
  const ledgerCount = await prisma.shippingLedger.count();
  const verifyCount = await prisma.deliveryVerification.count();
  const eventCount = await prisma.shipmentEvent.count();
  const shipmentCount = await prisma.shipment.count();
  const orderCount = await prisma.order.count();
  const agentCount = await prisma.deliveryAgent.count();
  const commentCount = await prisma.comment.count();
  const likeCount = await prisma.adLike.count();
  const messageCount = await prisma.message.count();
  const notificationCount = await prisma.notification.count();
  const reportCount = await prisma.report.count();
  const reviewCount = await prisma.review.count();
  const reelCount = await prisma.reel.count();
  const imageCount = await prisma.adImage.count();
  const adCount = await prisma.ad.count();
  const tokenCount = await prisma.refreshToken.count();
  const userCount = await prisma.user.count({
    where: { role: { not: UserRole.ADMIN } },
  });

  console.log('\n📊 Statistics of records to be deleted:');
  console.log(`- Outbox Events: ${outboxCount}`);
  console.log(`- Analytics Events: ${analyticsCount}`);
  console.log(`- Security Events: ${securityEventCount}`);
  console.log(`- Admin Logs: ${adminLogCount}`);
  console.log(`- Beta Invitations: ${betaInviteCount}`);
  console.log(`- Shipping Ledger Entries: ${ledgerCount}`);
  console.log(`- Delivery Verifications: ${verifyCount}`);
  console.log(`- Shipment Events: ${eventCount}`);
  console.log(`- Shipments: ${shipmentCount}`);
  console.log(`- Orders: ${orderCount}`);
  console.log(`- Delivery Agents: ${agentCount}`);
  console.log(`- Comments: ${commentCount}`);
  console.log(`- Ad Likes: ${likeCount}`);
  console.log(`- Messages/Chats: ${messageCount}`);
  console.log(`- Notifications: ${notificationCount}`);
  console.log(`- Reports: ${reportCount}`);
  console.log(`- Reviews: ${reviewCount}`);
  console.log(`- Reels: ${reelCount}`);
  console.log(`- Ad Images: ${imageCount}`);
  console.log(`- Ads: ${adCount}`);
  console.log(`- Refresh Tokens: ${tokenCount}`);
  console.log(`- Non-Admin Users: ${userCount}`);

  if (dryRun) {
    console.log('\nℹ️ Dry run completed. No data was modified.');
    return;
  }

  // 2. Perform backup
  console.log('\n📦 Creating database JSON backup before sanitization...');
  const backupData: any = {};
  backupData.users = await prisma.user.findMany({ where: { role: { not: UserRole.ADMIN } } });
  backupData.ads = await prisma.ad.findMany();
  backupData.adImages = await prisma.adImage.findMany();
  backupData.orders = await prisma.order.findMany();
  backupData.shipments = await prisma.shipment.findMany();
  backupData.messages = await prisma.message.findMany();
  backupData.notifications = await prisma.notification.findMany();
  backupData.comments = await prisma.comment.findMany();
  backupData.adLikes = await prisma.adLike.findMany();

  const backupDir = path.join(process.cwd(), 'uploads', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, `backup-before-sanitize-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`💾 Backup successfully saved to: ${backupPath}`);

  // 3. Perform Deletions
  console.log('\n🧹 Clearing transaction and mock data tables...');
  await prisma.outboxEvent.deleteMany({});
  await prisma.analyticsEvent.deleteMany({});
  await prisma.securityEvent.deleteMany({});
  await prisma.adminLog.deleteMany({});
  await prisma.betaInvitation.deleteMany({});
  await prisma.shippingLedger.deleteMany({});
  await prisma.deliveryVerification.deleteMany({});
  await prisma.shipmentEvent.deleteMany({});
  await prisma.shipment.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.deliveryAgent.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.adLike.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.reel.deleteMany({});
  await prisma.adImage.deleteMany({});
  await prisma.ad.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({
    where: {
      role: {
        not: UserRole.ADMIN,
      },
    },
  });

  // 4. Sanitize remaining Admin accounts
  console.log('🛡️ Sanitizing remaining Admin accounts...');
  for (const admin of admins) {
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        phone: null,
        phoneVerified: false,
        avatar: null,
        bio: 'مدير عام المنصة - فريق الدعم المعتمد لأسواق',
      },
    });
    console.log(`  - Sanitized Admin: ${admin.email}`);
  }

  // 5. Verify system metadata table counts
  const categoryCount = await prisma.category.count();
  const subCategoryCount = await prisma.subCategory.count();
  const zoneCount = await prisma.shippingZone.count();
  const carrierCount = await prisma.carrierConfiguration.count();

  console.log('\n📊 Preserved Metadata Check:');
  console.log(`- Categories: ${categoryCount}`);
  console.log(`- Sub-categories: ${subCategoryCount}`);
  console.log(`- Shipping Zones: ${zoneCount}`);
  console.log(`- Carrier configurations: ${carrierCount}`);

  console.log('\n✅ Aswaq database sanitization completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Sanitization script encountered an error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
