import { PrismaClient } from '@prisma/client';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

const prisma = new PrismaClient();
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME || 'aswaq-uploads';

async function main() {
  console.log('🔍 Starting full broken links scan...');
  const images = await prisma.adImage.findMany({
    select: { id: true, url: true, objectKey: true, adId: true }
  });

  console.log(`Found ${images.length} images to scan.`);
  const broken: any[] = [];

  let s3: S3Client | null = null;
  if (accountId && accessKeyId && secretAccessKey) {
    s3 = new S3Client({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      region: 'auto'
    });
  }

  for (const img of images) {
    if (img.objectKey && s3) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: img.objectKey }));
      } catch (err: any) {
        console.error(`❌ Broken link in database: AdImage[${img.id}] -> key: ${img.objectKey}. Error: ${err.message}`);
        broken.push({ id: img.id, type: 'R2', key: img.objectKey, adId: img.adId, error: err.message });
      }
    } else if (img.url && img.url.startsWith('/uploads/')) {
      const filePath = `uploads/${img.url.replace('/uploads/', '')}`;
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Broken local file: AdImage[${img.id}] -> path: ${filePath}`);
        broken.push({ id: img.id, type: 'Local', path: filePath, adId: img.adId, error: 'File not found on disk' });
      }
    }
  }

  console.log('\n--- SCAN RESULT ---');
  if (broken.length === 0) {
    console.log('✅ All image links are fully verified and active.');
  } else {
    console.log(`⚠️  Found ${broken.length} broken links! Writing results to broken_links.json...`);
    fs.writeFileSync('broken_links.json', JSON.stringify(broken, null, 2));
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
