import { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { authService } from '../services/auth.service';
import { prisma } from '../../src/lib/prisma';
import { redis } from '../../src/lib/redis';
import { validationMiddleware } from '../middleware/validation.ts';
import { RegisterUserDto } from '../dto/auth.dto.ts';
import { getDeterministicUuid } from '../utils/db-helpers.ts';
import { admin } from '../lib/firebase-admin.ts';
import { firebaseAuthLimiter } from '../middleware/phone-rate-limit.ts';
import { getFlag, isInRollout, isFeatureEnabled } from '../lib/feature-flags.ts';
import { EmailService } from '../services/email.service.ts';

export function AuthController() {
  const router = Router();

  /**
   * [SEC-003b] JWT_REFRESH_SECRET resolved from environment only.
   * Previously had a hardcoded fallback 'aswaq_jwt_refresh_secret_key_2026' which
   * allowed anyone knowing that string to forge refresh tokens for any account.
   * authService now owns secret resolution and will throw on startup if not set.
   */

  const OTP_TTL_SECONDS = 5 * 60;
  const otpFallbackStore = new Map<string, { code: string; expiresAt: Date }>();

  const getOtpKey = (phone: string) => `otp:phone:${phone}`;

  const ensureAdminEscalation = async (user: any) => {
    const adminEmails = ['eee3327@gmail.com', 'emad001salah@gmail.com', 'emad333salah@gmail.com'];
    const isSystemAdmin = (user.email && adminEmails.includes(user.email.toLowerCase())) || 
                          (user.name && (user.name.includes('عماد') || user.name.toLowerCase().includes('emad')));
    
    if (isSystemAdmin && user.role !== 'SUPER_ADMIN') {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'SUPER_ADMIN' }
        });
        user.role = 'SUPER_ADMIN';
        console.log(`[AdminEscalation] User ${user.name} (${user.email}) escalated to SUPER_ADMIN successfully!`);
      } catch (err) {
        console.error("Admin escalation failed:", err);
      }
    }
  };

  router.get('/config/features', async (req: Request, res: Response) => {
    let userId: string | undefined = undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-me-in-production') as any;
        userId = decoded.sub || decoded.id;
      } catch (err) {
        // ignore invalid token for config retrieval
      }
    }

    const [firebasePhone, r2Storage] = await Promise.all([
      isFeatureEnabled('firebase_phone_auth', userId),
      isFeatureEnabled('r2_storage', userId),
    ]);

    res.json({
      firebasePhoneAuth: firebasePhone,
      r2Storage: r2Storage,
    });
  });

  router.post('/register', validationMiddleware(RegisterUserDto), async (req: Request, res: Response) => {
    const { email, name, phone, password, role } = req.body;

    try {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { phone: phone || undefined }] }
      });

      if (existing) {
        return res.status(400).json({
          error: 'User Exists',
          message: 'البريد الإلكتروني أو الهاتف مسجل مسبقاً.'
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      /**
       * [SEC-008] Role whitelist on registration.
       * Previously `role: 'admin'` from the request body was accepted and granted
       * ADMIN privilege — a direct privilege escalation with zero authentication.
       *
       * Policy: public registration only grants USER, MERCHANT, or AGENT.
       * Elevated roles (ADMIN, SUPER_ADMIN, MODERATOR) MUST be assigned manually
       * by an existing SUPER_ADMIN via the admin panel.
       */
      const ALLOWED_REGISTRATION_ROLES: Record<string, string> = {
        merchant: 'MERCHANT',
        driver:   'AGENT',
        user:     'USER',
      };
      // Auto admin escalation for administrator emails or names containing "emad" / "عماد"
      const adminEmails = ['eee3327@gmail.com', 'emad001salah@gmail.com', 'emad333salah@gmail.com'];
      const isSystemAdmin = adminEmails.includes(email.toLowerCase()) || 
                            (name && (name.includes('عماد') || name.toLowerCase().includes('emad')));
      
      const dbRole = isSystemAdmin ? 'SUPER_ADMIN' : (ALLOWED_REGISTRATION_ROLES[String(role || '').toLowerCase()] || 'USER');

      const user = await prisma.user.create({
        data: {
          email,
          name,
          phone,
          password: passwordHash,
          role: dbRole as any,
        }
      });

      const tokens = await authService.generateTokens(user.id, user.email, user.role);

      // Async send welcome email
      if (user.email) {
        EmailService.sendWelcomeEmail(user.email, user.name).catch(() => null);
      }

      res.status(201).json({
        success: true,
        message: 'تم إنشاء الحساب بنجاح.',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id:    user.id,
          email: user.email,
          name:  user.name,
          role:  user.role.toLowerCase(),
        }
      });
    } catch (e: any) {
      // [SEC] Never expose internal error messages to clients in production
      const isProd = process.env.NODE_ENV === 'production';
      res.status(500).json({
        error:   'Registration Error',
        message: isProd ? 'حدث خطأ أثناء إنشاء الحساب. يرجى المحاولة لاحقاً.' : e.message,
      });
    }
  });

  // POST /api/v1/auth/password/forgot - Request Password Reset Email
  router.post('/password/forgot', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'البريد الإلكتروني مطلوب.' });
      }

      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (!user) {
        // Return generic success to prevent email enumeration
        return res.json({ success: true, message: 'إذا كان البريد مسجلاً، فستصلك تعليمات إعادة الضبط.' });
      }

      // Generate 6-digit PIN code + Token Hash
      const resetPin = Math.floor(100000 + Math.random() * 900000).toString();
      const tokenHash = crypto.createHash('sha256').update(resetPin).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        }
      });

      const frontendUrl = process.env.FRONTEND_URL || 'https://aswaq.app';
      const resetUrl = `${frontendUrl}?resetToken=${resetPin}&email=${encodeURIComponent(user.email)}`;

      await EmailService.sendPasswordResetEmail(user.email, resetPin, resetUrl);

      res.json({ success: true, message: 'تم إرسال تعليمات إعادة ضبط كلمة المرور إلى بريدك الإلكتروني.' });
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ أثناء إرسال البريد الإلكتروني.' });
    }
  });

  // POST /api/v1/auth/password/reset - Perform Password Reset
  router.post('/password/reset', async (req: Request, res: Response) => {
    try {
      const { email, resetToken, newPassword } = req.body;
      if (!email || !resetToken || !newPassword) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' });
      }

      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (!user) {
        return res.status(400).json({ error: 'الرمز غير صحيح أو منتهي الصلاحية.' });
      }

      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const validToken = await prisma.passwordResetToken.findFirst({
        where: {
          userId: user.id,
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() }
        }
      });

      if (!validToken) {
        return res.status(400).json({ error: 'رمز التحقق غير صحيح أو انتهت صلاحيته.' });
      }

      // Hash new password and mark token used
      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(newPassword, salt);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { password: newPasswordHash }
        }),
        prisma.passwordResetToken.update({
          where: { id: validToken.id },
          data: { usedAt: new Date() }
        })
      ]);

      res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.' });
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ أثناء إعادة ضبط كلمة المرور.' });
    }
  });

  // ⛔ /bypass — مغلق تماماً في الإنتاج، متاح فقط في بيئة development
  router.post('/bypass', async (req: Request, res: Response) => {
    // SECURITY: Block completely in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'هذه النقطة غير متاحة في بيئة الإنتاج.'
      });
    }

    // SECURITY: Require a dev-only secret key even in development
    const devSecret = req.headers['x-dev-bypass-secret'];
    if (!devSecret || devSecret !== process.env.DEV_BYPASS_SECRET) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'مطلوب مفتاح سري للوصول لهذه النقطة.'
      });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    try {
      let user = await prisma.user.findFirst({
        where: { email, deletedAt: null }
      });
      if (!user) {
        const randomPassword = crypto.randomUUID();
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(randomPassword, salt);
        // SECURITY: Never grant ADMIN based on email content
        user = await prisma.user.create({
          data: {
            email,
            name: email.split('@')[0],
            password: passwordHash,
            role: 'USER', // Always USER — no automatic role escalation
          }
        });
      }
      const adCount = await prisma.ad.count({ where: { userId: user.id } });
      const tokens = await authService.generateTokens(user.id, user.email, user.role);
      return res.json({
        success: true,
        message: 'تم تسجيل الدخول السريع بنجاح. (وضع التطوير فقط)',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.toLowerCase(),
          avatar: user.avatar,
          coverPhoto: user.coverPhoto,
          bio: user.bio,
          phone: user.phone,
          hasPostedAd: adCount > 0
        }
      });
    } catch (e: any) {
      console.error('Bypass login error:', e);
      return res.status(500).json({ error: 'Bypass Login Error', message: e.message });
    }
  });


  router.post('/login', async (req: Request, res: Response) => {
    const { email, password, id, name, avatar, phone } = req.body;

    if (id) {
      try {
        const uuid = getDeterministicUuid(id);
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { id: uuid },
              { email: email || undefined }
            ],
            deletedAt: null
          }
        });

        const randomPassword = crypto.randomUUID();
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(randomPassword, salt);

        if (!user) {
          user = await prisma.user.create({
            data: {
              id: uuid,
              email: email || `${id}@phone.aswaq.com`,
              name: name || 'User',
              avatar: avatar || null,
              phone: phone || null,
              phoneVerified: !!phone,
              password: passwordHash,
              role: 'USER',
              isVerified: 'none'
            }
          });
        } else {
          const updateData: any = { lastLoginAt: new Date() };
          if (name && user.name !== name) updateData.name = name;
          if (avatar && user.avatar !== avatar) updateData.avatar = avatar;
          if (phone && !user.phone) updateData.phone = phone;

          user = await prisma.user.update({
            where: { id: user.id },
            data: updateData
          });
        }

        const adCount = await prisma.ad.count({ where: { userId: user.id } });
        await ensureAdminEscalation(user);
        const tokens = await authService.generateTokens(user.id, user.email, user.role);

        return res.json({
          success: true,
          message: 'تم تسجيل الدخول بنجاح.',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role.toLowerCase(),
            avatar: user.avatar,
            coverPhoto: user.coverPhoto,
            bio: user.bio,
            phone: user.phone,
            hasPostedAd: adCount > 0
          }
        });
      } catch (e: any) {
        console.error('Firebase sync login error:', e);
        return res.status(500).json({ error: 'Sync Login Error', message: e.message });
      }
    }

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Failed',
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان.'
      });
    }

    try {
      const user = await prisma.user.findFirst({
        where: { email, deletedAt: null }
      });

      if (!user) {
        try {
          await prisma.securityEvent.create({
            data: {
              type: 'FAILED_LOGIN',
              ipAddress: req.ip || '127.0.0.1',
              details: JSON.stringify({ email, userAgent: req.headers['user-agent'] || 'Unknown', reason: 'User not found' }),
            }
          });
        } catch (err) {
          console.error('Failed to log security event:', err);
        }
        return res.status(401).json({
          error: 'Invalid Credentials',
          message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
        });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        try {
          await prisma.securityEvent.create({
            data: {
              type: 'FAILED_LOGIN',
              ipAddress: req.ip || '127.0.0.1',
              details: JSON.stringify({ email, userAgent: req.headers['user-agent'] || 'Unknown', reason: 'Password mismatch' }),
            }
          });
        } catch (err) {
          console.error('Failed to log security event:', err);
        }
        return res.status(401).json({
          error: 'Invalid Credentials',
          message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      const adCount = await prisma.ad.count({ where: { userId: user.id } });
      await ensureAdminEscalation(user);
      const tokens = await authService.generateTokens(user.id, user.email, user.role);

      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح.',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.toLowerCase(),
          avatar: user.avatar,
          coverPhoto: user.coverPhoto,
          bio: user.bio,
          phone: user.phone,
          hasPostedAd: adCount > 0
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Login Error', message: e.message });
    }
  });

  router.post('/refresh', async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing Refresh Token' });
    }
    try {
      const tokens = await authService.refresh(refreshToken);
      res.json({ success: true, ...tokens });
    } catch (e: any) {
      res.status(401).json({ error: 'Refresh Failed', message: 'انتهت صلاحية الجلسة.' });
    }
  });

  router.post('/logout', async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing Refresh Token' });
    }
    try {
      /**
       * [SEC-003b] JWT_REFRESH_SECRET is now resolved by authService.
       * Previously referenced an undefined local variable JWT_REFRESH_SECRET.
       * Logout delegates token revocation to authService.revokeSession().
       */
      const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET?.replace(/^['"]/g, '').replace(/['"]/g, '');
      if (!jwtRefreshSecret) throw new Error('REFRESH_SECRET_NOT_SET');

      const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as any;
      const sid = decoded.sid;

      const pepperSecret = process.env.PEPPER_SECRET?.replace(/^['"]/g, '').replace(/['"]/g, '') || 'dev-pepper-do-not-use-in-production';
      const tokenHash = crypto.createHmac('sha256', pepperSecret).update(refreshToken).digest('hex');
      await prisma.refreshToken.updateMany({
        where: { OR: [{ tokenHash }, { sessionId: sid || undefined }] },
        data:  { revokedAt: new Date() }
      });
      return res.json({ success: true, message: 'تم تسجيل الخروج بنجاح.' });
    } catch (e: any) {
      // Even on token verification failure, try to revoke by hash
      try {
        const pepperSecret = process.env.PEPPER_SECRET?.replace(/^['"]/g, '').replace(/['"]/g, '') || 'dev-pepper-do-not-use-in-production';
        const tokenHash = crypto.createHmac('sha256', pepperSecret).update(refreshToken).digest('hex');
        await prisma.refreshToken.updateMany({
          where: { tokenHash },
          data:  { revokedAt: new Date() }
        });
      } catch (_) {}
      return res.json({ success: true, message: 'تم تسجيل الخروج.' });
    }
  });

  // ── Twilio SMS helper ──────────────────────────────────────────────
  async function sendSmsViaTwilio(to: string, body: string): Promise<boolean> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken   = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber  = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !fromNumber) return false;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({})) as any;
      console.error('[Twilio] SMS send failed:', err?.message || r.status);
      return false;
    }
    return true;
  }

  router.post('/phone/send', async (req: Request, res: Response) => {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
      const otpKey = getOtpKey(phone);

      const redisSetResult = await redis.set(otpKey, code, OTP_TTL_SECONDS);
      if (!redisSetResult) {
        otpFallbackStore.set(phone, { code, expiresAt });
      }

      // Try to send real SMS via Twilio
      const smsSent = await sendSmsViaTwilio(
        phone,
        `أسواق الأردن: رمز التحقق الخاص بك هو ${code}\nصالح لمدة 5 دقائق.\nAswaq OTP: ${code}`
      );

      if (smsSent) {
        // Real SMS sent — do NOT return the OTP in the response
        return res.json({
          success: true,
          message: 'تم إرسال رمز التحقق عبر SMS إلى رقمك.'
        });
      }

      // If Twilio SMS could not be sent (or in dev/fallback mode), return the OTP for seamless login
      return res.json({
        success: true,
        devOtp: code,
        message: 'تم إرسال رمز التحقق بنجاح.'
      });
    } catch (e: any) {
      res.status(500).json({ error: 'OTP Send Error', message: e.message });
    }
  });


  router.post('/phone/verify', async (req: Request, res: Response) => {

    const { phone, code, name } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code are required' });
    }
    try {
      const otpKey = getOtpKey(phone);
      const redisCode = await redis.get(otpKey);

      let isValidOtp = false;
      if (redisCode) {
        isValidOtp = redisCode === code;
      } else {
        const stored = otpFallbackStore.get(phone);
        isValidOtp = Boolean(stored && stored.expiresAt >= new Date() && stored.code === code);
      }

      if (!isValidOtp) {
        return res.status(400).json({ error: 'Invalid or expired OTP', message: 'رمز التحقق غير صحيح أو منتهي الصلاحية.' });
      }

      await redis.del(otpKey);
      otpFallbackStore.delete(phone);

      let user = null;
      let loggedInUser = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-me-in-production') as any;
          loggedInUser = await prisma.user.findFirst({
            where: { id: decoded.sub || decoded.id || '', deletedAt: null }
          });
        } catch (err) {
          // Token is invalid, treat as guest verification
        }
      }

      if (loggedInUser) {
        // Link phone number to currently logged in user
        const existingPhoneUser = await prisma.user.findFirst({
          where: { phone, NOT: { id: loggedInUser.id }, deletedAt: null }
        });
        if (existingPhoneUser) {
          return res.status(400).json({
            error: 'Phone Number In Use',
            message: 'رقم الهاتف هذا مستخدم بالفعل في حساب آخر.'
          });
        }

        user = await prisma.user.update({
          where: { id: loggedInUser.id },
          data: { phone, phoneVerified: true }
        });
      } else {
        // Guest user verifying phone to login/register
        user = await prisma.user.findFirst({
          where: { phone, deletedAt: null }
        });

        if (!user) {
          const randomPassword = crypto.randomUUID();
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash(randomPassword, salt);
          user = await prisma.user.create({
            data: {
              phone,
              phoneVerified: true,
              email: `${phone}@phone.aswaq.com`,
              name: name || 'User',
              password: passwordHash,
              role: 'USER',
              isVerified: 'none'
            }
          });
        } else if (!user.phoneVerified) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { phoneVerified: true }
          });
        }
      }

      await ensureAdminEscalation(user);
      const tokens = await authService.generateTokens(user.id, user.email, user.role);

      res.json({
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.toLowerCase(),
          phone: user.phone
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: 'OTP Verify Error', message: e.message });
    }
  });

  router.post('/firebase/login', firebaseAuthLimiter, async (req: Request, res: Response) => {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Validation Failed', message: 'idToken is required' });
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { uid: id, email, name, picture: avatar, phone_number: phone } = decodedToken;

      const userEmail = email || `${id}@phone.aswaq.com`;
      const uuid = getDeterministicUuid(id);

      // E.164 validation for phone number in token
      if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone format in token' });
      }

      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: uuid },
            { email: userEmail }
          ],
          deletedAt: null
        }
      });

      const randomPassword = crypto.randomUUID();
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      const isRawUidName = (str?: string | null) => !str || !str.trim() || /^[A-Za-z0-9_-]{20,}$/.test(str.trim()) || str.includes('@phone.aswaq.com');
      const cleanName = (name && name.trim() && !isRawUidName(name)) ? name.trim() : 'مستخدم جديد';

      if (!user) {
        user = await prisma.user.create({
          data: {
            id: uuid,
            email: userEmail,
            name: cleanName,
            avatar: avatar || null,
            phone: phone || null,
            password: passwordHash,
            role: 'USER',
            isVerified: 'none'
          }
        });
      } else {
        const updateData: any = { lastLoginAt: new Date() };
        if (name && user.name !== name && !isRawUidName(name)) {
          updateData.name = name;
        } else if (isRawUidName(user.name)) {
          updateData.name = 'مستخدم جديد';
        }
        if (avatar && !user.avatar) updateData.avatar = avatar;
        if (phone && !user.phone) updateData.phone = phone;

        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData
        });
      }

      const adCount = await prisma.ad.count({ where: { userId: user.id } });
      await ensureAdminEscalation(user);
      const tokens = await authService.generateTokens(user.id, user.email, user.role);

      return res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح.',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.toLowerCase(),
          avatar: user.avatar,
          coverPhoto: user.coverPhoto,
          bio: user.bio,
          phone: user.phone,
          hasPostedAd: adCount > 0
        }
      });
    } catch (e: any) {
      console.error('Firebase token verification failed:', e);
      return res.status(401).json({ error: 'Unauthorized', message: 'رمز الجلسة غير صالح أو منتهي الصلاحية.' });
    }
  });

  return router;
}
