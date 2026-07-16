import { Request, Response, Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { authService } from '../services/auth.service';
import { prisma } from '../../src/lib/prisma';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDeterministicUuid } from '../utils/db-helpers.ts';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// These are safe fallbacks - never throw on missing env vars
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI?.trim() || 'http://localhost:3000/api/v1/auth/oauth2/callback';
const WEB_RETURN_URL = process.env.WEB_RETURN_URL?.trim() || 'http://localhost:3000/';
const MOBILE_DEEPLINK = process.env.MOBILE_DEEPLINK?.trim() || 'com.aswaq.enterprise://oauth';
const ADMIN_URL = process.env.ADMIN_URL?.trim() || 'http://localhost:3002/';

console.log('[OAuth] Config loaded:', {
  GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID ? '✅ set' : '❌ missing',
  GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET ? '✅ set' : '❌ missing',
  GOOGLE_REDIRECT_URI,
  WEB_RETURN_URL,
});

function getClient(): OAuth2Client | null {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

async function upsertUserFromGoogle(profile: {
  googleId: string;
  email: string;
  name: string;
  avatar: string | null;
}) {
  const uuid = getDeterministicUuid(profile.googleId);

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: uuid },
        { email: profile.email }
      ],
      deletedAt: null,
    },
  });

  const randomPassword = crypto.randomUUID();
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(randomPassword, salt);

  const ADMIN_EMAILS = ['eee3327@gmail.com', 'emad001salah@gmail.com'];
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: uuid,
        email: profile.email || `${profile.googleId}@google.aswaq.com`,
        name: profile.name || 'User',
        avatar: profile.avatar || null,
        password: passwordHash,
        role: ADMIN_EMAILS.includes(profile.email) ? 'ADMIN' : 'USER',
        isVerified: 'none',
      },
    });
  } else {
    const updateData: any = { lastLoginAt: new Date() };
    if (profile.name && user.name !== profile.name) updateData.name = profile.name;
    if (profile.avatar && user.avatar !== profile.avatar) updateData.avatar = profile.avatar;
    // Always ensure owner emails have ADMIN role
    if (ADMIN_EMAILS.includes(profile.email) && user.role !== 'ADMIN') {
      updateData.role = 'ADMIN';
    }

    user = await prisma.user.update({ where: { id: user.id }, data: updateData });
  }

  const adCount = await prisma.ad.count({ where: { userId: user.id } });
  const tokens = await authService.generateTokens(user.id, user.email, user.role);

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.toLowerCase(),
      avatar: user.avatar,
      phone: user.phone,
      hasPostedAd: adCount > 0,
    },
  };
}

export function OAuthController() {
  const router = Router();

  router.get('/oauth2/google', (req: Request, res: Response) => {
    const client = getClient();
    if (!client) {
      return res.status(500).json({
        error: 'OAuth Not Configured',
        message: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET غير معيّنة في البيئة.',
      });
    }

    const state = (req.query.state as string) || 'web';
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile'],
      state,
    });

    return res.redirect(url);
  });

  router.get('/oauth2/callback', async (req: Request, res: Response) => {
    const { code, state } = req.query;
    console.log('[OAuth] callback hit - state:', state, 'code present:', !!code);
    console.log('[OAuth] WEB_RETURN_URL:', WEB_RETURN_URL);
    console.log('[OAuth] GOOGLE_REDIRECT_URI:', GOOGLE_REDIRECT_URI);

    if (!code) {
      console.error('[OAuth] No code received!');
      return res.redirect(`${WEB_RETURN_URL}?auth=error&reason=missing_code`);
    }

    const client = getClient();
    if (!client) {
      console.error('[OAuth] Client not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return res.redirect(`${WEB_RETURN_URL}?auth=error&reason=not_configured`);
    }

    try {
      const { tokens } = await client.getToken(code as string);
      client.setCredentials(tokens);

      const idToken = tokens.id_token;
      if (!idToken) throw new Error('لم يتم استقبال idToken من جوجل');

      const ticket = await client.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) throw new Error('فشل قراءة بيانات الحساب من جوجل');

      console.log('[OAuth] Google payload received for:', payload.email);

      const result = await upsertUserFromGoogle({
        googleId: payload.sub,
        email: payload.email || '',
        name: payload.name || 'User',
        avatar: payload.picture || null,
      });

      const userParam = encodeURIComponent(JSON.stringify(result.user));

      if (state === 'mobile') {
        const deepLink = `${MOBILE_DEEPLINK}?access_token=${encodeURIComponent(
          result.accessToken
        )}&refresh_token=${encodeURIComponent(result.refreshToken)}&user=${userParam}`;
        return res.redirect(deepLink);
      }

      if (state === 'admin') {
        const returnUrl = `${ADMIN_URL}?auth=success&access_token=${encodeURIComponent(
          result.accessToken
        )}&refresh_token=${encodeURIComponent(result.refreshToken)}&user=${userParam}`;
        return res.redirect(returnUrl);
      }

      // Default Web Client redirect
      const baseUrl = WEB_RETURN_URL || `${req.protocol}://${req.get('host')}/`;
      const returnUrl = `${baseUrl}?auth=success&access_token=${encodeURIComponent(
        result.accessToken
      )}&refresh_token=${encodeURIComponent(result.refreshToken)}&user=${userParam}`;
      console.log('[OAuth] Redirecting to:', returnUrl.substring(0, 100) + '...');
      return res.redirect(returnUrl);
    } catch (e: any) {
      console.error('[OAuth] callback error:', e);
      const targetUrl = state === 'admin' ? ADMIN_URL : WEB_RETURN_URL;
      return res.redirect(
        `${targetUrl}?auth=error&reason=${encodeURIComponent(e.message || 'oauth_failed')}`
      );
    }
  });

  return router;
}
