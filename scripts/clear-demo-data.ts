import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MANAGER_EMAILS = ['emad001salah@gmail.com', 'eee3327@gmail.com'];

async function main() {
  console.log('[Cleanup] Starting database cleanup of all demo accounts and listings...');

  // 1. Identify manager accounts to keep
  const managers = await prisma.user.findMany({
    where: {
      email: { in: MANAGER_EMAILS }
    },
    select: { id: true, email: true, name: true }
  });

  const managerIds = managers.map(m => m.id);
  console.log('[Cleanup] Manager accounts identified to KEEP:', managers.map(m => `${m.name} (${m.email})`).join(', '));

  // 2. Delete all AdLikes
  console.log('[Cleanup] Deleting all ad likes...');
  await prisma.adLike.deleteMany({});

  // 3. Delete all Comments
  console.log('[Cleanup] Deleting all comments...');
  await prisma.comment.deleteMany({});

  // 4. Delete all Messages
  console.log('[Cleanup] Deleting all messages...');
  await prisma.message.deleteMany({});

  // 5. Delete all Notifications
  console.log('[Cleanup] Deleting all notifications...');
  await prisma.notification.deleteMany({});

  // 6. Delete all Reports
  console.log('[Cleanup] Deleting all reports...');
  await prisma.report.deleteMany({});

  // 7. Delete all Reels
  console.log('[Cleanup] Deleting all reels...');
  await prisma.reel.deleteMany({});

  // 8. Delete all AdImages
  console.log('[Cleanup] Deleting all ad images...');
  await prisma.adImage.deleteMany({});

  // 9. Delete all Ads
  console.log('[Cleanup] Deleting all ads...');
  await prisma.ad.deleteMany({});

  // 10. Delete all RefreshTokens
  console.log('[Cleanup] Deleting all refresh tokens...');
  await prisma.refreshToken.deleteMany({});

  // 11. Delete all Users except managers
  console.log('[Cleanup] Deleting all users except managers...');
  const deleteUsersResult = await prisma.user.deleteMany({
    where: {
      id: { notIn: managerIds }
    }
  });
  console.log(`[Cleanup] Deleted ${deleteUsersResult.count} demo users.`);

  // 12. Delete Admin Logs & Security Events
  console.log('[Cleanup] Deleting all admin logs and security events...');
  await prisma.adminLog.deleteMany({});
  await prisma.securityEvent.deleteMany({});

  console.log('[Cleanup] Database is now clean and ready for production!');
}

main()
  .catch((e) => {
    console.error('[Cleanup] Error during database cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
