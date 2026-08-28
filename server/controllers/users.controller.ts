import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma.ts';
import { authService } from '../services/auth.service.ts';
import { storageService } from '../services/storage.service.ts';
import { validationMiddleware } from '../middleware/validation.ts';
import { RegisterUserDto, LoginUserDto } from '../dto/auth.dto.ts';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.ts';
import { cacheService } from '../services/cache.service.ts';

export const UsersController = () => {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          role: true,
          isVerified: true,
          phoneVerified: true,
          emailVerified: true,
          createdAt: true,
        }
      });
      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: 'Database Error', message: e.message });
    }
  });

  router.get('/manager', async (req, res) => {
    try {
      const manager = await prisma.user.findFirst({
        where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, deletedAt: null },
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
        },
        orderBy: { createdAt: 'asc' }
      });
      if (manager) {
        return res.json(manager);
      }
      res.json({
        name: 'Emad Salah',
        avatar: 'https://lh3.googleusercontent.com/a/ACg8ocILZLj44t6xsNGSs0XS0LWGNknuYW-7HX_HLmWQ0duGl8STxw=s96-c'
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Database Error', message: e.message });
    }
  });

  router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await prisma.user.findFirst({
        where: { id: req.user?.id, deletedAt: null },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          bio: true,
          coverPhoto: true,
          role: true,
          isVerified: true,
          phoneVerified: true,
          emailVerified: true,
          createdAt: true,
        }
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      const sanitizeAvatar = (url?: string | null) => {
        if (!url || typeof url !== 'string') return null;
        let trimmed = url.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('data:image/') || trimmed.includes('r2.dev') || trimmed.includes('cloudfront') || trimmed.includes('amazonaws')) return trimmed;
        if (trimmed.includes('media.aswaq22.com') || trimmed.includes('www.aswaq22.com')) {
          trimmed = trimmed.replace(/^https?:\/\/(www\.|media\.)?aswaq22\.com/i, 'https://api.aswaq22.com');
        }
        return trimmed;
      };

      res.json({
        ...user,
        avatar: sanitizeAvatar(user.avatar),
        role: user.role.toLowerCase()
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Database Error', message: e.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const user = await prisma.user.findFirst({
        where: { id: req.params.id, deletedAt: null },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          bio: true,
          coverPhoto: true,
          role: true,
          isVerified: true,
          phoneVerified: true,
          emailVerified: true,
          createdAt: true,
        }
      });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const sanitizeAvatar = (url?: string | null) => {
        if (!url || typeof url !== 'string') return null;
        let trimmed = url.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('data:image/') || trimmed.includes('r2.dev') || trimmed.includes('cloudfront') || trimmed.includes('amazonaws')) return trimmed;
        if (trimmed.includes('media.aswaq22.com') || trimmed.includes('www.aswaq22.com')) {
          trimmed = trimmed.replace(/^https?:\/\/(www\.|media\.)?aswaq22\.com/i, 'https://api.aswaq22.com');
        }
        return trimmed;
      };

      res.json({
        ...user,
        avatar: sanitizeAvatar(user.avatar),
        role: user.role.toLowerCase()
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Database Error', message: e.message });
    }
  });

  // PUT /api/users/:id (Secure via authMiddleware)
  /**
   * @openapi
   * /users/{id}:
   *   put:
   *     summary: Update profile details of a user
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               phone:
   *                 type: string
   *               avatar:
   *                 type: string
   *               bio:
   *                 type: string
   *               city:
   *                 type: string
   *               coverPhoto:
   *                 type: string
   *     responses:
   *       200:
   *         description: User profile updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   */
  const handleUserUpdate = async (req: AuthenticatedRequest, res: Response) => {
    const targetUserId = req.params.id === 'me' || !req.params.id ? req.user?.id : req.params.id;

    if (req.user?.id !== targetUserId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'مطلوب تسجيل الدخول بحساب صاحب الملف لتحديثه.' });
    }

    try {
      const userIdToUpdate = targetUserId!;
      let avatarUrl = req.body.avatar;
      let coverUrl = req.body.coverPhoto;

      if (avatarUrl && avatarUrl.startsWith('data:image/')) {
        try {
          const matches = avatarUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const ext = mimeType.split('/')[1] || 'jpg';
            const uploadedUrl = await storageService.uploadFile({
              buffer,
              originalname: `avatar-${Date.now()}.${ext}`,
              mimetype: mimeType
            }, `uploads/avatars/${userIdToUpdate}`);
            // Save any successful storage URL (local, R2, S3, etc.) - not just R2
            if (uploadedUrl && (uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://'))) {
              avatarUrl = uploadedUrl;
            } else {
              // Keep base64 as absolute last resort (shouldn't happen)
              logger.warn(`[Users] Avatar upload returned unexpected URL format: ${uploadedUrl}`);
            }
          }
        } catch (err) {
          console.error('Failed to upload base64 avatar to storage:', err);
          // Keep base64 as fallback so user doesn't lose their avatar
        }
      }

      if (coverUrl && coverUrl.startsWith('data:image/')) {
        try {
          const matches = coverUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const ext = mimeType.split('/')[1] || 'jpg';
            const uploadedUrl = await storageService.uploadFile({
              buffer,
              originalname: `cover-${Date.now()}.${ext}`,
              mimetype: mimeType
            }, `uploads/covers/${userIdToUpdate}`);
            // Save any successful storage URL (local, R2, S3, etc.)
            if (uploadedUrl && (uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://'))) {
              coverUrl = uploadedUrl;
            }
          }
        } catch (err) {
          console.error('Failed to upload base64 cover to storage:', err);
        }
      }

      // Build update object with only known Prisma schema fields
      // (ignore client-side fields like priceDropAlerts, newAdAlerts, alertCity)
      const updateData: any = {};
      if (req.body.name !== undefined) updateData.name = String(req.body.name).trim();
      if (req.body.phone !== undefined) updateData.phone = req.body.phone ? String(req.body.phone).trim() : null;
      if (req.body.email !== undefined) {
        const inputEmail = String(req.body.email).trim();
        if (inputEmail && !inputEmail.includes('@phone.aswaq.com')) {
          updateData.email = inputEmail;
        }
      }
      if (avatarUrl !== undefined) updateData.avatar = avatarUrl || null;
      if (req.body.bio !== undefined) updateData.bio = req.body.bio || null;
      if (req.body.city !== undefined) updateData.city = req.body.city || null;
      if (coverUrl !== undefined) updateData.coverPhoto = coverUrl || null;

      // Reject empty updates early to avoid unnecessary DB writes
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update', message: 'لا توجد بيانات صحيحة للتحديث.' });
      }

      const updated = await prisma.user.update({
        where: { id: userIdToUpdate },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          bio: true,
          coverPhoto: true,
          role: true,
          isVerified: true,
          phoneVerified: true,
          emailVerified: true,
        }
      });

      // Invalidate Redis feed caches so all users across the platform see the updated user avatar instantly
      try {
        await cacheService.invalidateFeedCaches();
      } catch (cacheErr) {}

      res.json(updated);
    } catch (e: any) {
      if (e.code === 'P2002') {
        return res.status(400).json({
          error: 'Phone Already In Use',
          message: 'رقم الهاتف هذا مستخدم بالفعل في حساب آخر.'
        });
      }
      res.status(500).json({ error: 'Update Failed', message: e.message });
    }
  };

  // GET /api/users/me & /api/users/profile
  const handleGetMe = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized', message: 'غير مصرح' });
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User Not Found', message: 'المستخدم غير موجود' });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch profile', message: e.message });
    }
  };

  router.get('/me', authMiddleware, handleGetMe);
  router.get('/profile', authMiddleware, handleGetMe);
  router.put('/me', authMiddleware, handleUserUpdate);
  router.patch('/me', authMiddleware, handleUserUpdate);
  router.patch('/profile', authMiddleware, handleUserUpdate);
  router.put('/profile', authMiddleware, handleUserUpdate);
  router.patch('/me/avatar', authMiddleware, handleUserUpdate);
  router.put('/:id', authMiddleware, handleUserUpdate);
  router.patch('/:id', authMiddleware, handleUserUpdate);

  // GET /api/users/:id/favorites
  router.get('/:id/favorites', async (req, res) => {
    try {
      const likes = await prisma.adLike.findMany({
        where: { userId: req.params.id },
        select: { adId: true }
      });
      res.json(likes.map(l => l.adId));
    } catch (e: any) {
      res.status(500).json({ error: 'Database Error', message: e.message });
    }
  });

  // POST /api/users/:id/favorites (Toggle Favorite)
  router.post('/:id/favorites', authMiddleware, async (req: AuthenticatedRequest, res) => {
    if (req.user?.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { adId, action } = req.body;

    try {
      if (action === 'add') {
        await prisma.adLike.upsert({
          where: {
            adId_userId: {
              adId,
              userId: req.params.id
            }
          },
          create: {
            adId,
            userId: req.params.id
          },
          update: {}
        });
      } else {
        await prisma.adLike.deleteMany({
          where: {
            adId,
            userId: req.params.id
          }
        });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: 'Favorite Action Failed', message: e.message });
    }
  });

  // PATCH /api/users/:id/verify (Secure via authMiddleware)
  router.patch('/:id/verify', authMiddleware, async (req: AuthenticatedRequest, res) => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { verified } = req.body;
    try {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { isVerified: verified ? 'verified' : 'none' },
        select: {
          id: true, email: true, name: true, phone: true,
          avatar: true, role: true, isVerified: true,
          phoneVerified: true, emailVerified: true, createdAt: true
        }
      });
      res.json({
        ...user,
        role: user.role.toLowerCase(),
        verified: user.isVerified === 'verified'
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Verification Action Failed', message: e.message });
    }
  });

  // PATCH /api/users/:id/status (Secure via authMiddleware)
  router.patch('/:id/status', authMiddleware, async (req: AuthenticatedRequest, res) => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { active } = req.body;
    try {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { deletedAt: active ? null : new Date() },
        select: {
          id: true, email: true, name: true, phone: true,
          avatar: true, role: true, isVerified: true,
          phoneVerified: true, emailVerified: true, createdAt: true,
          deletedAt: true
        }
      });
      res.json({
        ...user,
        role: user.role.toLowerCase(),
        active: !user.deletedAt
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Status Action Failed', message: e.message });
    }
  });

  // POST /api/users/verification-request (Submit KYC / Merchant / Driver documents)
  router.post('/verification-request', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { type = 'personal', idDocumentUrl, driverLicenseUrl, commercialRegUrl, notes } = req.body;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isVerified: 'pending',
          verificationType: type,
          idDocumentUrl: idDocumentUrl || null,
          driverLicenseUrl: driverLicenseUrl || null,
          commercialRegUrl: commercialRegUrl || null,
          verificationNote: notes || null,
        },
        select: {
          id: true, name: true, email: true, phone: true, avatar: true,
          isVerified: true, verificationType: true, createdAt: true
        }
      });

      res.json({
        success: true,
        message: 'تم تقديم طلب التوثيق بنجاح وسيتم مراجعته من الإدارة في أقرب وقت.',
        user: updatedUser
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to submit verification', message: e.message });
    }
  });

  // GET /api/users/verification-requests (Admin list pending requests)
  router.get('/verification-requests', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userRole = (req.user?.role || '').toUpperCase();
      if (!['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(userRole)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const pendingUsers = await prisma.user.findMany({
        where: { isVerified: 'pending' },
        select: {
          id: true, name: true, email: true, phone: true, avatar: true,
          role: true, isVerified: true, verificationType: true,
          idDocumentUrl: true, driverLicenseUrl: true, commercialRegUrl: true,
          verificationNote: true, createdAt: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      res.json(pendingUsers);
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch verification requests', message: e.message });
    }
  });

  return router;
};
