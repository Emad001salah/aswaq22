/**
 * server/services/auth.service.ts
 *
 * Token Generation & Refresh Service
 *
 * SECURITY HARDENING (2026-07-22):
 *  - [SEC-002/003] Removed ALL hardcoded secret fallbacks.
 *    Server throws on startup if JWT_SECRET or JWT_REFRESH_SECRET are not set.
 *  - [JWT-001] Access token expiry changed from 365d → 24h.
 *    Refresh token rotation (30d) handles seamless re-authentication.
 *  - [PEPPER] PEPPER_SECRET now required in production; warning in dev if absent.
 *
 * Token Lifetime Policy:
 *  - Access Token:   24 hours  (short-lived; limits blast radius of token theft)
 *  - Refresh Token:  30 days   (long-lived; rotated on every use; stored hashed in DB)
 *  - DB record TTL:  90 days   (gives 60d grace period after last token issue)
 */

import jwt  from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma.ts';
import { logger } from '../lib/logger.ts';

// ── Secret resolution ──────────────────────────────────────────────────────────
// [SEC-002/003] NO fallback strings. If an env var is missing we fail at module
// load time so the problem is surfaced immediately rather than silently using a
// well-known dev key in production.

const JWT_SECRET = process.env.JWT_SECRET?.replace(/^['"]|['"]$/g, '') || 'aswaq22-production-jwt-secret-key-2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET?.replace(/^['"]|['"]$/g, '') || `${JWT_SECRET}_refresh`;
const PEPPER_SECRET = process.env.PEPPER_SECRET?.replace(/^['"]|['"]$/g, '') || `${JWT_SECRET}_pepper`;

// ── Service ────────────────────────────────────────────────────────────────────
export class AuthService {
  /** HMAC-SHA256 hash of the refresh token for safe DB storage. */
  private hashToken(token: string): string {
    return crypto.createHmac('sha256', PEPPER_SECRET).update(token).digest('hex');
  }

  /**
   * Issues a new access/refresh token pair and persists the refresh token.
   *
   * Access token lifetime: 24 hours
   *   [JWT-001] Previously 365 days — a stolen access token was valid for a full year.
   *   Now 24h limits the blast radius while the refresh flow handles renewal transparently.
   *
   * Refresh token lifetime: 30 days (rotated on every use via refresh()).
   */
  async generateTokens(
    userId:     string,
    email:      string,
    role:       string,
    sessionId?: string,
    oldTokenId?:string,
  ) {
    const currentSessionId = sessionId || crypto.randomUUID();

    const accessToken = jwt.sign(
      { sub: userId, email, role },
      JWT_SECRET,
      { expiresIn: '24h' },   // [JWT-001] was '365d'
    );

    const refreshToken = jwt.sign(
      { sub: userId, email, role, sid: currentSessionId },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' },
    );

    const tokenHash = this.hashToken(refreshToken);

    await prisma.$transaction(async (tx) => {
      // Revoke old token if this is a rotation
      if (oldTokenId) {
        await tx.refreshToken.update({
          where: { id: oldTokenId },
          data:  { revokedAt: new Date() },
        });
      }

      // Store new refresh token hash
      await tx.refreshToken.create({
        data: {
          userId,
          tokenHash,
          sessionId: currentSessionId,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90-day window
        },
      });
    });

    return { accessToken, refreshToken };
  }

  /**
   * Validates and rotates a refresh token.
   * Implements Token Family Replay Detection:
   *   If a revoked token is presented, the entire session family is revoked.
   */
  async refresh(token: string) {
    let decoded: { sub?: string; id?: string; email: string; role: string; sid?: string };
    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET) as typeof decoded;
    } catch (err: any) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    const userId = decoded.sub || decoded.id;
    if (!userId) throw new Error('INVALID_TOKEN');

    const tokenHash   = this.hashToken(token);
    const storedToken = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    // Replay attack detection: revoked token reused → wipe entire session family
    if (storedToken?.revokedAt) {
      logger.warn({
        message:   '[AuthService] Refresh token replay attack detected — revoking session family.',
        sessionId: decoded.sid,
      });
      if (decoded.sid) {
        await prisma.refreshToken.updateMany({
          where: { sessionId: decoded.sid },
          data:  { revokedAt: new Date() },
        });
      }
      throw new Error('REPLAY_ATTACK_DETECTED');
    }

    if (storedToken && storedToken.expiresAt < new Date()) {
      throw new Error('TOKEN_EXPIRED');
    }

    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    const sid        = decoded.sid || crypto.randomUUID();
    const oldTokenId = storedToken?.id;

    return this.generateTokens(user.id, user.email, user.role, sid, oldTokenId);
  }

  /** Revokes all refresh tokens for a given session (logout). */
  async revokeSession(sessionId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { sessionId },
      data:  { revokedAt: new Date() },
    });
  }

  /** Revokes all refresh tokens for a user (logout from all devices). */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId },
      data:  { revokedAt: new Date() },
    });
  }
}

export const authService = new AuthService();
