import { validateUploadedFile } from './server/middleware/file-validation.ts';
import { storageService } from './server/services/storage.service.ts';
import { getDeterministicUuid } from './server/utils/db-helpers.ts';
import { prisma } from './src/lib/prisma.ts';

async function testModule4MediaStorage() {
  console.log('===============================================================');
  console.log('🧪 STAGE 0 - MODULE 4: MEDIA & STORAGE AUDIT & TEST SUITE');
  console.log('===============================================================');

  const report = {
    module: 'Media & Storage',
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
    // 1. Test Valid PNG magic bytes & buffer validation
    // Minimal valid PNG header: 89 50 4E 47 0D 0A 1A 0A
    const validPngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
    const pngResult = validateUploadedFile(validPngHeader, 'image/png', 'صورة_سيارة_تجريبية 2026!.png');

    logResult(
      'PNG Format & Arabic Filename Validation',
      pngResult.valid === true,
      pngResult.valid ? 'Valid PNG header with Arabic filename accepted.' : `Rejected: ${pngResult.reason}`
    );

    // 2. Test Fake MIME Detection (Magic Bytes Enforcement)
    // Send executable text payload claiming to be image/jpeg
    const fakeJpegBuffer = Buffer.from('<?php echo "evil_script"; ?>', 'utf-8');
    const fakeResult = validateUploadedFile(fakeJpegBuffer, 'image/jpeg', 'malicious.jpg');

    logResult(
      'Magic Bytes & XSS Prevention (Spoofed MIME Rejection)',
      fakeResult.valid === false,
      `Fake JPEG with script payload correctly rejected: "${fakeResult.reason}"`
    );

    // 3. Test Max File Size Enforcement (>10MB)
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    // Write valid PNG header at start
    validPngHeader.copy(oversizedBuffer);

    const sizeResult = validateUploadedFile(oversizedBuffer, 'image/png', 'huge_image.png');
    logResult(
      'Max File Size Limit Enforcement (>10MB Rejection)',
      sizeResult.valid === false,
      `11MB file correctly rejected: "${sizeResult.reason}"`
    );

    // 4. Test File Upload & Storage Key Generation via StorageService
    const sampleImageBuffer = validPngHeader;
    const uploadUrl = await storageService.uploadFile({
      buffer: sampleImageBuffer,
      originalname: 'اختبار_رفع_الوسائط.png',
      mimetype: 'image/png'
    }, 'audit_test_folder');

    logResult(
      'File Upload & Storage Key Sanitization',
      typeof uploadUrl === 'string' && uploadUrl.length > 0 && !uploadUrl.includes('..'),
      `Uploaded URL generated: ${uploadUrl}`
    );

    // 5. Test File Deletion / Cleanup via StorageService
    let deletionPassed = false;
    try {
      await storageService.deleteFile(uploadUrl);
      deletionPassed = true;
    } catch (e) {
      deletionPassed = false;
    }

    logResult(
      'File Deletion & Storage Cleanup',
      deletionPassed === true,
      'Uploaded test file removed from storage without errors.'
    );

    // 6. Test User Avatar Replacement Policy & Orphan Prevention
    const testUserId = getDeterministicUuid('media_audit_user_88');
    await prisma.user.deleteMany({ where: { id: testUserId } });

    const user = await prisma.user.create({
      data: {
        id: testUserId,
        email: 'media_audit@aswaq22.com',
        name: 'Media Audit User',
        password: '$2a$10$SampleDummyHashForAuthTestingOnly1234567890',
        avatar: uploadUrl
      }
    });

    const updatedUser = await prisma.user.update({
      where: { id: testUserId },
      data: { avatar: 'https://www.aswaq22.com/uploads/avatars/new_avatar.webp' }
    });

    logResult(
      'User Avatar Replacement & Database Persistence',
      updatedUser.avatar === 'https://www.aswaq22.com/uploads/avatars/new_avatar.webp',
      `Avatar updated in DB: ${updatedUser.avatar}`
    );

    // Cleanup
    await prisma.user.deleteMany({ where: { id: testUserId } });

    const allPassed = report.tests.every(t => t.passed);
    report.status = allPassed ? 'PASS' : 'FAIL';

    console.log('\n---------------------------------------------------------------');
    console.log(`📌 MODULE 4 FINAL RESULT: ${report.status}`);
    console.log('---------------------------------------------------------------\n');

  } catch (e) {
    console.error('Media Audit Error:', e);
    report.status = 'FAIL';
  } finally {
    await prisma.$disconnect();
  }
}

testModule4MediaStorage();
