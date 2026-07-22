/**
 * scripts/generate-android-icons.ts
 *
 * Resizes public/aswaq-admin-avatar.png into clean Android launcher icons across all mipmap sizes
 */

import sharp from 'sharp';
import path from 'path';

const sourceIcon = path.resolve('public/aswaq-admin-avatar.png');
const resDir = path.resolve('android/app/src/main/res');

const sizes = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

async function generateIcons() {
  console.log('🖼️ Resizing Android icons...');

  for (const item of sizes) {
    const targetFolder = path.join(resDir, item.folder);
    const targetFile = path.join(targetFolder, 'ic_launcher.png');
    const targetRound = path.join(targetFolder, 'ic_launcher_round.png');
    const targetFore = path.join(targetFolder, 'ic_launcher_foreground.png');

    await sharp(sourceIcon).png().resize(item.size, item.size).toFile(targetFile);
    await sharp(sourceIcon).png().resize(item.size, item.size).toFile(targetRound);
    await sharp(sourceIcon).png().resize(item.size, item.size).toFile(targetFore);

    console.log(`  ✅ Generated ${item.folder} (${item.size}x${item.size}px)`);
  }

  console.log('✨ All Android launcher icons generated successfully!');
}

generateIcons().catch(console.error);
