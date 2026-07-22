/**
 * server/controllers/admin.controller.ts
 *
 * Controller handling Admin Panel, Employees, Audit Logs, and User Management
 *
 * Clean Architecture Refactor (2026-07-22):
 *  - Extracted admin management routes from app.ts into an isolated module.
 *  - Enforces Super Admin access checks and password hashing.
 */

import { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/lib/prisma.ts';
import { logger } from '../lib/logger.ts';
import { authMiddleware, rolesGuard } from '../middleware/auth.ts';

export function AdminController() {
  const router = Router();

  const populateAdminUser = async (req: any, res: any, next: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      req.adminUser = user;
      next();
    } catch (err) {
      next(err);
    }
  };

  const adminAccessGuards = [authMiddleware, rolesGuard(['ADMIN', 'SUPER_ADMIN']), populateAdminUser];

  // GET /api/admin/employees
  router.get('/employees', ...adminAccessGuards, async (req: any, res: Response, next) => {
    try {
      const adminUser = req.adminUser;
      if (adminUser.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Super Admin only' });
      }

      const employees = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          managedCountry: true,
          permissions: true,
          createdAt: true,
          deletedAt: true,
        },
      });

      const mappedEmployees = employees.map((emp) => ({
        ...emp,
        active: emp.deletedAt === null,
      }));

      res.json(mappedEmployees);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/admin/employees
  router.post('/employees', ...adminAccessGuards, async (req: any, res: Response, next) => {
    try {
      const adminUser = req.adminUser;
      if (adminUser.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Super Admin only' });
      }

      const { name, email, password, role, managedCountry, permissions } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة.' });
      }
      if (password.length < 10) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role: role || 'ADMIN',
          managedCountry: managedCountry || null,
          permissions: permissions || [],
          isVerified: 'verified',
        },
      });

      const { password: _pw, ...safeUser } = newUser as any;
      res.status(201).json(safeUser);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/admin/employees/:id
  router.patch('/employees/:id', ...adminAccessGuards, async (req: any, res: Response, next) => {
    try {
      const adminUser = req.adminUser;
      if (adminUser.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Super Admin only' });
      }

      const { id } = req.params;
      const { name, email, password, role, managedCountry, permissions, active } = req.body;

      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'الموظف غير موجود.' });
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (role) updateData.role = role;
      if (managedCountry !== undefined) updateData.managedCountry = managedCountry;
      if (permissions !== undefined) updateData.permissions = permissions;

      if (password && password.length >= 10) {
        updateData.password = await bcrypt.hash(password, 12);
      }

      if (active === false && existing.deletedAt === null) {
        updateData.deletedAt = new Date();
      } else if (active === true && existing.deletedAt !== null) {
        updateData.deletedAt = null;
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      const { password: _pw, ...safeUser } = updatedUser as any;
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/admin/employees/:id
  router.delete('/employees/:id', ...adminAccessGuards, async (req: any, res: Response, next) => {
    try {
      const adminUser = req.adminUser;
      if (adminUser.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Super Admin only' });
      }

      const { id } = req.params;
      if (id === adminUser.id) {
        return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص.' });
      }

      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      res.json({ success: true, message: 'تم إيقاف الموظف بنجاح.' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
