import { Controller, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import sharp from 'sharp';

@Controller('api/storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File | any) {
    if (file && file.mimetype && file.mimetype.startsWith('image/')) {
      // Compress image using sharp
      const compressedBuffer = await sharp(file.buffer)
        .resize(800, 800, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();
        
      file.buffer = compressedBuffer;
      file.mimetype = 'image/webp';
      file.originalname = file.originalname.split('.')[0] + '.webp';
      file.size = compressedBuffer.length;
    }
    
    return this.storageService.uploadFile(file);
  }
}
