/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { storageService } from '../server/services/storage.service.ts';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const uploadDir = path.join(process.cwd(), 'uploads');

async function main() {
  console.log('🚀 Starting local uploads migration to cloud storage...');
  
  if (!fs.existsSync(uploadDir)) {
    console.log('📁 Local uploads directory does not exist or is empty. Nothing to migrate.');
    return;
  }

  // 1. Migrate User Avatars
  const usersWithLocalAvatars = await prisma.user.findMany({
    where: {
      avatar: {
        startsWith: '/uploads/'
      }
    }
  });

  console.log(`👤 Found ${usersWithLocalAvatars.length} users with local avatars.`);

  for (const user of usersWithLocalAvatars) {
    if (!user.avatar) continue;
    const filename = path.basename(user.avatar);
    const localFilePath = path.join(uploadDir, filename);

    if (fs.existsSync(localFilePath)) {
      try {
        console.log(`Uploading avatar for user ${user.email} (${filename})...`);
        const fileBuffer = await fs.promises.readFile(localFilePath);
        
        const fileData = {
          buffer: fileBuffer,
          originalname: filename,
          mimetype: getMimeType(filename)
        };

        const cloudUrl = await storageService.uploadFile(fileData);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { avatar: cloudUrl }
        });
        
        console.log(`✅ Successfully migrated avatar. New URL: ${cloudUrl}`);
      } catch (err: any) {
        console.error(`❌ Failed to migrate avatar for user ${user.id}: ${err.message}`);
      }
    } else {
      console.warn(`⚠️ Local file not found for user avatar: ${localFilePath}`);
    }
  }

  // 2. Migrate Ad Images
  const localAdImages = await prisma.adImage.findMany({
    where: {
      url: {
        startsWith: '/uploads/'
      }
    }
  });

  console.log(`🖼️ Found ${localAdImages.length} ad images with local URLs.`);

  for (const img of localAdImages) {
    const filename = path.basename(img.url);
    const localFilePath = path.join(uploadDir, filename);

    if (fs.existsSync(localFilePath)) {
      try {
        console.log(`Uploading ad image ${filename} for ad ID ${img.adId}...`);
        const fileBuffer = await fs.promises.readFile(localFilePath);
        
        const fileData = {
          buffer: fileBuffer,
          originalname: filename,
          mimetype: getMimeType(filename)
        };

        const cloudUrl = await storageService.uploadFile(fileData);
        
        await prisma.adImage.update({
          where: { id: img.id },
          data: { url: cloudUrl }
        });
        
        console.log(`✅ Successfully migrated ad image. New URL: ${cloudUrl}`);
      } catch (err: any) {
        console.error(`❌ Failed to migrate ad image ID ${img.id}: ${err.message}`);
      }
    } else {
      console.warn(`⚠️ Local file not found for ad image: ${localFilePath}`);
    }
  }

  console.log('🏁 Migration process completed!');
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mp4') return 'video/mp4';
  return 'image/jpeg';
}

main()
  .catch(err => console.error('Fatal error during migration:', err))
  .finally(() => prisma.$disconnect());
