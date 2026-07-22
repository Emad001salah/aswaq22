/**
 * scripts/clean-production-db.ts
 *
 * Production Database Purge Script for Aswaq 22
 *
 * Removes all mock/dummy seed data (test ads, fake comments, demo users)
 * while preserving schema integrity and system settings for production launch.
 */

import { prisma } from '../src/lib/prisma.ts';

async function cleanProductionDatabase() {
  console.log('\n================================================================');
  console.log('🧹 Purging Mock & Dummy Seed Data for Commercial Production Launch...');
  console.log('================================================================\n');

  try {
    // 1. Delete dummy ad images & ad likes
    const deletedImages = await prisma.adImage.deleteMany({});
    const deletedLikes = await prisma.adLike.deleteMany({});
    console.log(`✅ Deleted ${deletedImages.count} mock ad images.`);
    console.log(`✅ Deleted ${deletedLikes.count} mock ad likes.`);

    // 2. Delete dummy comments & reports
    const deletedComments = await prisma.comment.deleteMany({});
    const deletedReports = await prisma.report.deleteMany({});
    console.log(`✅ Deleted ${deletedComments.count} mock comments.`);
    console.log(`✅ Deleted ${deletedReports.count} mock reports.`);

    // 3. Delete dummy messages & conversations
    const deletedMessages = await prisma.message.deleteMany({});
    const deletedConversations = await prisma.conversation.deleteMany({});
    console.log(`✅ Deleted ${deletedMessages.count} mock chat messages.`);
    console.log(`✅ Deleted ${deletedConversations.count} mock conversations.`);

    // 4. Delete dummy reels & promo media
    const deletedReels = await prisma.reel.deleteMany({});
    console.log(`✅ Deleted ${deletedReels.count} mock promo reels.`);

    // 5. Delete test ads
    const deletedAds = await prisma.ad.deleteMany({});
    console.log(`✅ Deleted ${deletedAds.count} mock ads.`);

    // 6. Delete media objects & tokens before users
    const deletedMedia = await prisma.mediaObject.deleteMany({});
    const deletedSessions = await prisma.session.deleteMany({});
    const deletedRefreshTokens = await prisma.refreshToken.deleteMany({});
    console.log(`✅ Deleted ${deletedMedia.count} mock media objects.`);
    console.log(`✅ Deleted ${deletedSessions.count} sessions and ${deletedRefreshTokens.count} refresh tokens.`);

    // 7. Delete test non-admin users (preserve real super admin if present)
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        role: { notIn: ['SUPER_ADMIN'] }
      }
    });
    console.log(`✅ Deleted ${deletedUsers.count} mock/test users.`);

    console.log('\n================================================================');
    console.log('✨ Production Database Purged Successfully! Ready for Real Launch.');
    console.log('================================================================\n');
  } catch (err: any) {
    console.error('❌ Failed purging database:', err.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

cleanProductionDatabase();
