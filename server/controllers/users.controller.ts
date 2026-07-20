import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma.ts';
import { authService } from '../services/auth.service.ts';
import { storageService } from '../services/storage.service.ts';
import { validationMiddleware } from '../middleware/validation.ts';
import { RegisterUserDto, LoginUserDto } from '../dto/auth.dto.ts';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.ts';

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
          name: true,
          avatar: true,
          email: true,
        }
      });
      if (!manager) {
        return res.json({
          name: 'إدارة أسواق',
          avatar: '/aswaq-admin-avatar.png'
        });
      }
      res.json(manager);
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
      res.json({
        ...user,
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
      res.json({
        ...user,
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
  router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    const targetUserId = req.params.id === 'me' ? req.user?.id : req.params.id;

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
            avatarUrl = await storageService.uploadFile({
              buffer,
              originalname: `avatar-${Date.now()}.${ext}`,
              mimetype: mimeType
            });
          }
        } catch (err) {
          console.error('Failed to upload base64 avatar to storage:', err);
        }
      }

      if (coverUrl && coverUrl.startsWith('data:image/')) {
        try {
          const matches = coverUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const ext = mimeType.split('/')[1] || 'jpg';
            coverUrl = await storageService.uploadFile({
              buffer,
              originalname: `cover-${Date.now()}.${ext}`,
              mimetype: mimeType
            });
          }
        } catch (err) {
          console.error('Failed to upload base64 cover to storage:', err);
        }
      }

      const updated = await prisma.user.update({
        where: { id: userIdToUpdate },
        data: {
          name: req.body.name,
          phone: req.body.phone ? req.body.phone.trim() : null,
          avatar: avatarUrl,
          bio: req.body.bio,
          city: req.body.city,
          coverPhoto: coverUrl,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          bio: true,
          coverPhoto: true,
          role: true,
        }
      });
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
  });

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

  return router;
};
