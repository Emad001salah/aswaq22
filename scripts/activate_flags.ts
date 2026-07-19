import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// Connect to Redis
const redisUrl = process.env.REDIS_URL;
let redisClient: Redis;
if (redisUrl) {
  redisClient = new Redis(redisUrl);
} else {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined
  });
}

async function main() {
  console.log('🔌 Connecting to DB and Redis...');
  
  // 1. Create or Update 'firebase_phone_auth'
  console.log('Setting feature flag [firebase_phone_auth] to 100% rollout...');
  await prisma.featureFlag.upsert({
    where: { key: 'firebase_phone_auth' },
    create: {
      key: 'firebase_phone_auth',
      name: 'Firebase Phone Authentication',
      enabled: true,
      rolloutPct: 100,
      allowedUsers: []
    },
    update: {
      enabled: true,
      rolloutPct: 100
    }
  });

  // 2. Create or Update 'r2_storage'
  console.log('Setting feature flag [r2_storage] to 100% rollout...');
  await prisma.featureFlag.upsert({
    where: { key: 'r2_storage' },
    create: {
      key: 'r2_storage',
      name: 'Cloudflare R2 Media Storage',
      enabled: true,
      rolloutPct: 100,
      allowedUsers: []
    },
    update: {
      enabled: true,
      rolloutPct: 100
    }
  });

  // 3. Clear Redis Caches
  console.log('🧹 Clearing Redis caches for feature flags...');
  try {
    await redisClient.del('feature_flag:firebase_phone_auth');
    await redisClient.del('feature_flag:r2_storage');
    await redisClient.del('feature_flag:r2_media_storage');
    console.log('✅ Redis cache cleared successfully.');
  } catch (err: any) {
    console.warn('⚠️ Could not clear Redis cache: ', err.message);
  }

  console.log('🎉 All feature flags activated successfully at 100% rollout!');
}

main()
  .catch(err => {
    console.error('Error activating feature flags:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await redisClient.quit();
  });
