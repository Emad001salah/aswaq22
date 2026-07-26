import { IsString, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { MAX_IMAGE_SIZE_BYTES } from '../../shared/constants.ts';

export class PresignUploadDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsNumber()
  @Min(1)
  @Max(MAX_IMAGE_SIZE_BYTES, { message: `حجم الصورة يجب أن لا يتجاوز ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} ميجابايت` })
  sizeBytes: number;
}
