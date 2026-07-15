import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsMobilePhone } from 'class-validator';

// ── Register ──────────────────────────────────────────────────────────────────
export class RegisterUserDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح.' })
  email!: string;

  @IsString()
  @MinLength(2,  { message: 'الاسم يجب أن لا يقل عن حرفين.' })
  @MaxLength(80, { message: 'الاسم طويل جداً.' })
  name!: string;

  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب أن لا تقل عن 8 أحرف.' })
  password!: string;

  @IsOptional()
  @IsMobilePhone(undefined, {}, { message: 'رقم الهاتف غير صالح.' })
  phone?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

// ── Login ─────────────────────────────────────────────────────────────────────
export class LoginUserDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح.' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'كلمة المرور مطلوبة.' })
  password!: string;
}

// ── Refresh Token ──────────────────────────────────────────────────────────────
export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

// ── OAuth2 ─────────────────────────────────────────────────────────────────────
export class OAuth2CallbackDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;

  @IsOptional()
  @IsString()
  provider?: 'google' | 'apple';
}
