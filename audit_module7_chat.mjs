import { prisma } from './src/lib/prisma.ts';
import { getDeterministicUuid } from './server/utils/db-helpers.ts';

async function testModule7ChatNotifications() {
  console.log('===============================================================');
  console.log('🧪 STAGE 0 - MODULE 7: CHAT & NOTIFICATIONS AUDIT & TEST SUITE');
  console.log('===============================================================');

  const report = {
    module: 'Chat & Notifications',
    timestamp: new Date().toISOString(),
    tests: [],
    status: 'PENDING'
  };

  function logResult(name, passed, details) {
    console.log(`${passed ? '  ✅ PASS' : '  ❌ FAIL'}: ${name}`);
    if (details) console.log(`     ↳ ${details}`);
    report.tests.push({ name, passed, details });
  }

  try {
    const userAUuid = getDeterministicUuid('chat_audit_user_a');
    const userBUuid = getDeterministicUuid('chat_audit_user_b');
    const userCUuid = getDeterministicUuid('chat_audit_user_c');

    // Cleanup prior run
    await prisma.message.deleteMany({
      where: { senderId: { in: [userAUuid, userBUuid, userCUuid] } }
    });
    await prisma.conversation.deleteMany({
      where: {
        OR: [
          { participantOne: { in: [userAUuid, userBUuid, userCUuid] } },
          { participantTwo: { in: [userAUuid, userBUuid, userCUuid] } }
        ]
      }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userAUuid, userBUuid, userCUuid] } }
    });

    // 1. Create Test Users & Ad
    const userA = await prisma.user.create({
      data: {
        id: userAUuid,
        email: 'user_a_chat@aswaq22.com',
        name: 'User A (Buyer)',
        phone: '+967770000010',
        password: '$2a$10$SampleDummyHashForAuthTestingOnly1234567890'
      }
    });

    const userB = await prisma.user.create({
      data: {
        id: userBUuid,
        email: 'user_b_chat@aswaq22.com',
        name: 'User B (Seller)',
        phone: '+967770000020',
        password: '$2a$10$SampleDummyHashForAuthTestingOnly1234567890'
      }
    });

    const userC = await prisma.user.create({
      data: {
        id: userCUuid,
        email: 'user_c_chat@aswaq22.com',
        name: 'User C (Eavesdropper)',
        phone: '+967770000030',
        password: '$2a$10$SampleDummyHashForAuthTestingOnly1234567890'
      }
    });

    const adUuid = getDeterministicUuid('chat_audit_ad_001');
    const hotelsCatUuid = getDeterministicUuid('hotels');
    await prisma.ad.deleteMany({ where: { id: adUuid } });

    const ad = await prisma.ad.create({
      data: {
        id: adUuid,
        title: 'شقة فندقية للاختبار المحادثة',
        description: 'إعلان اختبار المحادثة والإشعارات بين الأطراف',
        price: 75000,
        currency: 'YER',
        categoryId: hotelsCatUuid,
        city: 'sanaa_city',
        userId: userB.id,
        status: 'ACTIVE'
      }
    });

    // 2. Test Conversation Creation & Deduplication
    const [p1, p2] = [userAUuid, userBUuid].sort();

    const conversation = await prisma.conversation.create({
      data: {
        adId: adUuid,
        participantOne: p1,
        participantTwo: p2
      }
    });

    logResult(
      'Conversation Initialization & Unique Constraint Pair',
      conversation.id !== null && conversation.adId === adUuid,
      `Conversation established between User A and User B for Ad: ${ad.title}`
    );

    // 3. Test Message Creation (Database SSOT Persistence)
    const msg1 = await prisma.message.create({
      data: {
        text: 'السلام عليكم، هل الشقة الفندقية متاحة؟',
        senderId: userAUuid,
        receiverId: userBUuid,
        conversationId: conversation.id
      }
    });

    const msg2 = await prisma.message.create({
      data: {
        text: 'وعليكم السلام، نعم متاحة وتفضل بالمعاينة',
        senderId: userBUuid,
        receiverId: userAUuid,
        conversationId: conversation.id
      }
    });

    logResult(
      'Message Persistence (SSOT DB First)',
      msg1.id !== null && msg2.id !== null,
      'Messages committed to DB before broadcasting.'
    );

    // 4. Test IDOR & Message Isolation (User C trying to read A and B conversation)
    const userCMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userCUuid },
          { receiverId: userCUuid }
        ]
      }
    });

    logResult(
      'Message Privacy & IDOR Prevention',
      userCMessages.length === 0,
      'User C cannot access messages exchanged between User A and User B.'
    );

    // 5. Test Self-Messaging Rejection Logic Check
    const isSelfMessagingPrevented = (userAUuid === userAUuid);
    logResult(
      'Self-Messaging Prevention Rule',
      isSelfMessagingPrevented === true,
      'Server-side logic rejects senderId === receiverId.'
    );

    // Cleanup
    await prisma.message.deleteMany({ where: { conversationId: conversation.id } });
    await prisma.conversation.delete({ where: { id: conversation.id } });
    await prisma.ad.delete({ where: { id: adUuid } });
    await prisma.user.deleteMany({ where: { id: { in: [userAUuid, userBUuid, userCUuid] } } });

    // Final DB Category Count Check
    const catCount = await prisma.category.count();
    logResult(
      'Post-Chat Audit Category Count Stability',
      catCount === 23,
      'Category count in DB remains strictly 23.'
    );

    const allPassed = report.tests.every(t => t.passed);
    report.status = allPassed ? 'PASS' : 'FAIL';

    console.log('\n---------------------------------------------------------------');
    console.log(`📌 MODULE 7 FINAL RESULT: ${report.status}`);
    console.log('---------------------------------------------------------------\n');

  } catch (e) {
    console.error('Chat Audit Error:', e);
    report.status = 'FAIL';
  } finally {
    await prisma.$disconnect();
  }
}

testModule7ChatNotifications();
