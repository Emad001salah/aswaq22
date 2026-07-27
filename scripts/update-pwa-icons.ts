import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

async function updatePwaIcons() {
  const source = path.resolve('public/custom-admin-logo.png');
  const publicDir = path.resolve('public');

  if (!fs.existsSync(source)) {
    console.error('Source icon not found:', source);
    return;
  }

  console.log('Generating PWA icons from custom-admin-logo.png...');

  // 192x192
  await sharp(source).resize(192, 192, { fit: 'cover' }).png().toFile(path.join(publicDir, 'aswaq-icon-192.png'));
  await sharp(source).resize(192, 192, { fit: 'cover' }).png().toFile(path.join(publicDir, 'aswaq-icon-maskable-192.png'));

  // 512x512
  await sharp(source).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(publicDir, 'aswaq-icon-512.png'));
  await sharp(source).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(publicDir, 'aswaq-icon-maskable-512.png'));
  await sharp(source).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(publicDir, 'aswaq-icon.png'));

  console.log('✅ Successfully updated all PWA icons in public/ with Admin Logo!');
}

updatePwaIcons().catch(console.error);
