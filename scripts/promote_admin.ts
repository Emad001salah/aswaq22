import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function run() {
  const emails = ['eee3327@gmail.com', 'emad001salah@gmail.com'];
  for (const email of emails) {
    try {
      let user = await prisma.user.findFirst({ where: { email } });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'ADMIN' },
        });
        console.log(`✅ Successfully promoted existing user: ${email}`);
      } else {
        const randomPassword = crypto.randomUUID();
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(randomPassword, salt);
        user = await prisma.user.create({
          data: {
            email,
            name: 'Admin',
            password: passwordHash,
            role: 'ADMIN',
            isVerified: 'none',
          },
        });
        console.log(`✅ Pre-created admin account for: ${email}`);
      }
    } catch (e: any) {
      console.error(`❌ Error handling ${email}:`, e.message);
    }
  }
  await prisma.$disconnect();
}

run();
