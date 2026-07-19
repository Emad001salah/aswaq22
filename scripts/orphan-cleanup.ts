import { PrismaClient } from '@prisma/client';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME || 'aswaq-uploads';

async function main() {
  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.log('R2 credentials not configured. Skipping orphan cleanup.');
    return;
  }

  const s3 = new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    region: 'auto'
  });

  console.log('🔍 Starting orphan media files scanning in R2...');
  
  const dbMedia = await prisma.mediaObject.findMany({ select: { objectKey: true } });
  const dbVariants = await prisma.mediaVariant.findMany({ select: { objectKey: true } });
  const dbAdImages = await prisma.adImage.findMany({ select: { objectKey: true } });

  const activeKeys = new Set<string>();
  dbMedia.forEach(m => m.objectKey && activeKeys.add(m.objectKey));
  dbVariants.forEach(v => v.objectKey && activeKeys.add(v.objectKey));
  dbAdImages.forEach(a => a.objectKey && activeKeys.add(a.objectKey));

  console.log(`Database contains ${activeKeys.size} active unique object keys.`);

  let isTruncated = true;
  let continuationToken: string | undefined = undefined;
  let totalScanned = 0;
  let deletedCount = 0;

  while (isTruncated) {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }));

    if (res.Contents) {
      for (const obj of res.Contents) {
        if (!obj.Key) continue;
        totalScanned++;

        if (!activeKeys.has(obj.Key)) {
          if (obj.Key.includes('/temp/') && obj.LastModified && (Date.now() - obj.LastModified.getTime() < 24 * 60 * 60 * 1000)) {
            continue;
          }

          console.log(`🗑️  Deleting orphan object: ${obj.Key}`);
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
          deletedCount++;
        }
      }
    }

    isTruncated = res.IsTruncated || false;
    continuationToken = res.NextContinuationToken;
  }

  console.log(`\nScan finished. Total Scanned: ${totalScanned}, Orphans Deleted: ${deletedCount}`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
