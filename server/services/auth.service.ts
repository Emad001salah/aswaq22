import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const PEPPER_SECRET = process.env.PEPPER_SECRET || 'fallback_pepper_secret_key';

export class AuthService {
  private hashToken(token: string): string {
    return crypto.createHmac('sha256', PEPPER_SECRET).update(token).digest('hex');
  }

  async generateTokens(userId: string, email: string, role: string, sessionId?: string, oldTokenId?: string) {
    const currentSessionId = sessionId || crypto.randomUUID();

    const accessToken = jwt.sign(
      { sub: userId, email, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { sub: userId, email, role, sid: currentSessionId },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    const tokenHash = this.hashToken(refreshToken);

    await prisma.$transaction(async (tx) => {
      // Invalidate old token if rotation is active
      if (oldTokenId) {
        await tx.refreshToken.update({
          where: { id: oldTokenId },
          data: { revokedAt: new Date() },
        });
      }

      await tx.refreshToken.create({
        data: {
          userId,
          tokenHash,
          sessionId: currentSessionId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    });

    return { accessToken, refreshToken };
  }

  async refresh(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { sub?: string; id?: string; email: string; role: string; sid?: string };
      const userId = decoded.sub || decoded.id;
      if (!userId) throw new Error('INVALID_TOKEN');

      const tokenHash = this.hashToken(token);

      const storedToken = await prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      // Token Replay Attack Detection: If token is revoked, invalidate the ENTIRE token family (all tokens under this sessionId)
      if (storedToken && storedToken.revokedAt) {
        console.warn(`[Auth Service] Replay attack detected for Session ID: ${decoded.sid}. Revoking all family tokens.`);
        if (decoded.sid) {
          await prisma.refreshToken.updateMany({
            where: { sessionId: decoded.sid },
            data: { revokedAt: new Date() },
          });
        }
        throw new Error('REPLAY_ATTACK_DETECTED');
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true }
      });
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const sid = decoded.sid || crypto.randomUUID();
      const oldTokenId = storedToken ? storedToken.id : undefined;

      // Generate new pair and revoke old one
      return this.generateTokens(user.id, user.email, user.role, sid, oldTokenId);
    } catch (err: any) {
      throw err;
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { sessionId },
      data: { revokedAt: new Date() },
    });
  }
}

export const authService = new AuthService();
