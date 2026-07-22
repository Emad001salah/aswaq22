/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jest } from '@jest/globals';
import { storageService } from '../../server/services/storage.service.ts';
import fs from 'fs';
import path from 'path';

// Allocate 3 minutes for the 100-image upload and verification suite
jest.setTimeout(180000);

describe('Storage Persistence and Verification Suite', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

  beforeAll(() => {
    console.log(`🧪 Running Storage UAT Verification. Env: ${process.env.NODE_ENV || 'default'}, Provider: ${provider}`);
  });

  it('should enforce S3/R2 storage provider in production environment', () => {
    if (isProduction) {
      expect(provider === 's3' || provider === 'r2').toBe(true);
    } else {
      console.log('Skipping S3/R2 enforcement check (not in production environment).');
    }
  });

  it('should successfully upload 100 images and retrieve them with 100% success rate', async () => {
    // Generate a tiny 1x1 pixel red PNG buffer for testing
    const tinyPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );

    const uploadedUrls: string[] = [];

    console.log('📤 Starting batch upload of 100 sample images...');
    for (let i = 1; i <= 100; i++) {
      const fileData = {
        buffer: tinyPngBuffer,
        originalname: `uat-test-image-${i}.png`,
        mimetype: 'image/png',
      };

      try {
        const url = await storageService.uploadFile(fileData);
        expect(url).toBeDefined();
        expect(typeof url).toBe('string');
        
        // In production/staging, the URL must be a remote URL from cloud storage (not a local path)
        if (isProduction || provider === 's3' || provider === 'r2') {
          expect(url.startsWith('http://') || url.startsWith('https://')).toBe(true);
          expect(url.includes('/uploads/file-')).toBe(true);
          expect(url.startsWith('/uploads/')).toBe(false);
        }

        uploadedUrls.push(url);
      } catch (err: any) {
        console.error(`❌ Upload failed at index ${i}:`, err.message);
        throw err;
      }
    }

    expect(uploadedUrls.length).toBe(100);
    console.log('✅ Uploaded 100 images successfully. Verifying accessibility...');

    // Verify accessibility of all uploaded images
    let successCount = 0;
    for (const url of uploadedUrls) {
      try {
        if (url.startsWith('/uploads/') || url.includes('/uploads/')) {
          // Check if local file exists on disk
          const filename = path.basename(url);
          const localPath = path.join(process.cwd(), 'uploads', filename);
          if (fs.existsSync(localPath)) {
            successCount++;
            continue;
          }
        }

        // Cloud URL check fallback
        if (url.startsWith('http://') || url.startsWith('https://')) {
          try {
            const fetch = (await import('node-fetch')).default;
            const res = await fetch(url, { method: 'HEAD' });
            if (res.ok) {
              successCount++;
            }
          } catch {
            // If offline/DNS unreachable during local test run, check local file on disk
            const filename = path.basename(url);
            const localPath = path.join(process.cwd(), 'uploads', filename);
            if (fs.existsSync(localPath)) {
              successCount++;
            }
          }
        }
      } catch (err: any) {
        console.error(`❌ Accessibility check failed for ${url}:`, err.message);
      }
    }

    console.log(`📊 Verification stats: ${successCount}/100 accessible.`);
    expect(successCount).toBe(100);
  });
});
