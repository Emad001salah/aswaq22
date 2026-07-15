import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emailsToKeep = ['emad001salah@gmail.com', 'eee3327@gmail.com'];

  console.log('--- STARTING DATABASE WIPE PROCESS ---');
  console.log('Keeping admin accounts:', emailsToKeep);

  try {
    // 1. Delete child records referencing users or ads
    console.log('Wiping sessions, tokens, comments, likes, reviews...');
    await prisma.adImage.deleteMany({});
    await prisma.adLike.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.reel.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});

    // 2. Wiping shipping and orders
    console.log('Wiping logistics, orders, and shipments...');
    await prisma.shipmentEvent.deleteMany({});
    await prisma.deliveryVerification.deleteMany({});
    await prisma.shippingLedger.deleteMany({});
    await prisma.shipment.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.deliveryAgent.deleteMany({});

    // 3. Wiping logs and polls
    console.log('Wiping system logs, events, and polls...');
    await prisma.report.deleteMany({});
    await prisma.adminLog.deleteMany({});
    await prisma.securityEvent.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
    await prisma.analyticsEvent.deleteMany({});
    await prisma.betaInvitation.deleteMany({});
    await prisma.poll.deleteMany({});
    await prisma.auditLog.deleteMany({});

    // 4. Wiping Ads
    console.log('Wiping marketplace advertisements (Ads)...');
    await prisma.ad.deleteMany({});

    // 5. Wiping non-admin users
    console.log('Wiping all user accounts except the two admins...');
    const result = await prisma.user.deleteMany({
      where: {
        email: {
          notIn: emailsToKeep,
        },
      },
    });
    console.log(`Successfully deleted ${result.count} test/user accounts.`);

    // 6. Verify remaining users
    const remainingUsers = await prisma.user.findMany({
      select: { email: true, name: true, role: true },
    });
    console.log('\nRemaining accounts in the database:');
    remainingUsers.forEach((u) => {
      console.log(`- ${u.name} (${u.email}) [Role: ${u.role}]`);
    });

    console.log('\n--- DATABASE WIPE COMPLETED SUCCESSFULLY ---');
  } catch (error) {
    console.error('Error during database wipe:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
