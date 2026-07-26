import { IsString, IsNumber, IsArray, IsOptional, IsNotEmpty, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_AD_IMAGES } from '../../shared/constants.ts';

export class AdImageDto {
  @IsOptional()
  @IsString()
  objectKey?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  mediaId?: string;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsString()
  blurHash?: string;
}

export class CreateAdDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsOptional()
  @IsString()
  jobType?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_AD_IMAGES, { message: `الحد الأقصى لعدد الصور هو ${MAX_AD_IMAGES}` })
  @ValidateNested({ each: true })
  @Type(() => AdImageDto)
  images?: AdImageDto[];

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  // Category Specific Dynamic Specification Fields (Stage 2)
  @IsOptional()
  customFieldValues?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  rooms?: number;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsArray()
  amenities?: string[];

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsNumber()
  modelYear?: number;

  @IsOptional()
  @IsString()
  transmission?: string;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsOptional()
  @IsNumber()
  kilometers?: number;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  condition?: string;
  // NOTE: `status` is intentionally excluded — determined server-side from user role only.
}
