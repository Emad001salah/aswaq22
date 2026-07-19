import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('[Backup] Starting database backup...');
  
  const backupDir = 'C:/Users/emado/.gemini/antigravity/brain/a1543445-ebdc-4f60-914d-ae7d235318d1/scratch';
  
  // Ensure directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const backupPath = path.join(backupDir, 'db_backup.json');

  try {
    // 1. Fetch data from tables
    const users = await prisma.user.findMany();
    const ads = await prisma.ad.findMany();
    const categories = await prisma.category.findMany();
    const subCategories = await prisma.subCategory.findMany();
    const adImages = await prisma.adImage.findMany();
    const messages = await prisma.message.findMany();
    const notifications = await prisma.notification.findMany();
    const likes = await prisma.adLike.findMany();
    const comments = await prisma.comment.findMany();
    const reels = await prisma.reel.findMany();
    const orders = await prisma.order.findMany();

    const backupData = {
      timestamp: new Date().toISOString(),
      users,
      ads,
      categories,
      subCategories,
      adImages,
      messages,
      notifications,
      likes,
      comments,
      reels,
      orders
    };

    // 2. Write to backup file
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    
    console.log(`[Backup] Database backup completed successfully!`);
    console.log(`[Backup] Backup file saved at: ${backupPath}`);
    console.log(`[Backup] Stats:`);
    console.log(` - Users: ${users.length}`);
    console.log(` - Ads: ${ads.length}`);
    console.log(` - Categories: ${categories.length}`);
    console.log(` - SubCategories: ${subCategories.length}`);
    console.log(` - Messages: ${messages.length}`);
    console.log(` - Notifications: ${notifications.length}`);
    
  } catch (error) {
    console.error('[Backup] Backup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
