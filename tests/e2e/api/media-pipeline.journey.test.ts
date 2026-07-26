import request from 'supertest';
import { App } from '../../../server/app.ts';
import { prisma } from '../../../src/lib/prisma.ts';
import jwt from 'jsonwebtoken';
import { getDeterministicUuid } from '../../../server/utils/db-helpers.ts';
import { processAdImageJob } from '../../../server/workers/image-resize.worker.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

describe('E2E Journey: Media Pipeline & Cloudflare R2 Uploads', () => {
  let serverInstance: App;
  let app: any;
  let userToken: string;
  let userId: string;
  const testUserEmail = `media-tester-${Date.now()}@aswaq.test`;

  beforeAll(async () => {
    serverInstance = new App();
    app = serverInstance.app;

    await prisma.category.upsert({
      where: { id: getDeterministicUuid('electronics') },
      update: {},
      create: {
        id: getDeterministicUuid('electronics'),
        nameAr: 'إلكترونيات',
        nameEn: 'Electronics',
        icon: 'Cpu',
      },
    });

    const user = await prisma.user.create({
      data: {
        email: testUserEmail,
        name: 'Media Tester',
        password: '$2b$12$dummyhashedpassword123456789012345',
        role: 'USER',
      },
    });
    userId = user.id;
    userToken = jwt.sign({ id: user.id, role: 'USER' }, JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await prisma.pendingUpload.deleteMany({ where: { userId } });
    await prisma.adImage.deleteMany({ where: { uploadedBy: userId } });
    await prisma.ad.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('1. POST /api/media/presign — should generate objectKey and uploadUrl for valid request', async () => {
    const res = await request(app)
      .post('/api/media/presign')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        filename: 'test-car.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 1024,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.uploadUrl).toBeDefined();
    expect(res.body.objectKey).toContain(`uploads/ads/${userId}/`);
    expect(res.body.expiresIn).toBe(300);

    // Verify PendingUpload DB record created
    const pending = await prisma.pendingUpload.findUnique({
      where: { objectKey: res.body.objectKey },
    });
    expect(pending).not.toBeNull();
    expect(pending?.userId).toBe(userId);
    expect(pending?.status).toBe('pending');
  });

  it('2. POST /api/media/presign — should reject invalid MIME type (e.g. image/svg+xml)', async () => {
    const res = await request(app)
      .post('/api/media/presign')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        filename: 'malicious.svg',
        mimeType: 'image/svg+xml',
        sizeBytes: 2048,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('نوع الملف غير مدعوم');
  });

  it('3. POST /api/media/presign — should reject oversized file (>15MB)', async () => {
    const res = await request(app)
      .post('/api/media/presign')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        filename: 'huge-video.mp4',
        mimeType: 'image/jpeg',
        sizeBytes: 20 * 1024 * 1024,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('حجم الملف غير صالح');
  });

  it('4. POST /api/ads — should reject ad creation if images array > 10', async () => {
    const elevenImages = Array.from({ length: 11 }, (_, i) => ({
      objectKey: `uploads/ads/${userId}/test-${i}.orig.jpg`,
    }));

    const res = await request(app)
      .post('/api/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Too Many Images Ad Test',
        description: 'Test description',
        price: 500,
        category: 'electronics',
        city: 'sanaa_city',
        images: elevenImages,
      });

    expect(res.status).toBe(400);
  });

  it('5. Full End-to-End: Presign -> Upload -> Create Ad -> Process Variants', async () => {
    // A. Presign
    const presignRes = await request(app)
      .post('/api/media/presign')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        filename: 'camera-phone.png',
        mimeType: 'image/png',
        sizeBytes: 500 * 1024,
      });

    expect(presignRes.status).toBe(200);
    const objectKey = presignRes.body.objectKey;

    // B. Simulate binary local upload
    const uploadRes = await request(app)
      .put(`/api/media/upload-local?key=${encodeURIComponent(objectKey)}`)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));

    expect(uploadRes.status).toBe(200);

    // C. Create Ad
    const createAdRes = await request(app)
      .post('/api/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Sony Camera Phone 100x Zoom',
        description: 'Excellent condition with original box and fast charger',
        price: 1200,
        category: 'electronics',
        city: 'sanaa_city',
        images: [{ objectKey, sortOrder: 0 }],
      });

    expect(createAdRes.status).toBe(201);
    const adId = createAdRes.body.ad.id;

    // D. Verify DB state before background worker
    const adImageBefore = await prisma.adImage.findFirst({
      where: { adId },
    });
    expect(adImageBefore).not.toBeNull();
    expect(adImageBefore?.objectKey).toBe(objectKey);

    // E. Execute Worker on the image
    await processAdImageJob({
      adImageId: adImageBefore!.id,
      objectKey,
      userId,
    });

    // F. Verify DB state after worker
    const adImageAfter = await prisma.adImage.findUnique({
      where: { id: adImageBefore!.id },
    });
    expect(adImageAfter?.status).toBe('ready');
    expect(adImageAfter?.thumbKey).toContain('.thumb.avif');
    expect(adImageAfter?.cardKey).toContain('.card.avif');
    expect(adImageAfter?.detailKey).toContain('.detail.webp');

    // G. Verify public feed GET /api/ads returns resolved thumbnail
    const feedRes = await request(app).get('/api/ads');
    expect(feedRes.status).toBe(200);
    const createdAdInFeed = feedRes.body.ads.find((a: any) => a.id === adId);
    expect(createdAdInFeed).toBeDefined();
    expect(createdAdInFeed.thumbnail).toContain('.thumb.avif');
  });
});
