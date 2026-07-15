import { IsString, IsNumber, IsArray, IsOptional, IsNotEmpty, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class AdImageDto {
  @IsString()
  @IsNotEmpty()
  url: string;

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
}
