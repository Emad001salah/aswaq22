import { Router } from 'express';
import { prisma } from '../../src/lib/prisma.ts';
import { getDeterministicUuid } from '../utils/db-helpers.ts';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CategoriesController = (adminAccessGuards: any[]) => {
  const router = Router();

  // GET /api/categories - Fetch all categories
  router.get('/', async (req, res, next) => {
    try {
      const categories = await prisma.category.findMany({
        include: { subCategories: true },
      });
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/categories - Create Category — Admin only
  router.post('/', ...adminAccessGuards, async (req, res, next) => {
    const { id, nameAr, nameEn, icon } = req.body;
    if (!nameAr || !nameEn || !icon) {
      return res.status(400).json({ error: 'Missing required category fields' });
    }
    const targetId = id ? (uuidRegex.test(id) ? id : getDeterministicUuid(id)) : undefined;
    try {
      const category = await prisma.category.create({
        data: { 
          id: targetId,
          nameAr, 
          nameEn, 
          icon 
        },
      });
      res.status(201).json(category);
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/categories/:id - Update Category — Admin only
  router.put('/:id', ...adminAccessGuards, async (req, res, next) => {
    const rawId = req.params.id;
    const id = uuidRegex.test(rawId) ? rawId : getDeterministicUuid(rawId);
    const { nameAr, nameEn, icon } = req.body;
    try {
      const category = await prisma.category.update({
        where: { id },
        data: { nameAr, nameEn, icon },
      });
      res.json(category);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/categories/:id - Delete Category — Admin only
  router.delete('/:id', ...adminAccessGuards, async (req, res, next) => {
    const rawId = req.params.id;
    const id = uuidRegex.test(rawId) ? rawId : getDeterministicUuid(rawId);
    try {
      await prisma.category.delete({
        where: { id },
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/categories/:id/subcategories - Add Subcategory — Admin only
  router.post('/:id/subcategories', ...adminAccessGuards, async (req, res, next) => {
    const { id: categoryId } = req.params;
    const { nameAr, nameEn } = req.body;
    if (!nameAr || !nameEn) {
      return res.status(400).json({ error: 'Missing required subcategory fields' });
    }
    try {
      const subCategory = await prisma.subCategory.create({
        data: {
          categoryId,
          nameAr,
          nameEn,
        },
      });
      res.status(201).json(subCategory);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/categories/:catId/subcategories/:subId - Delete Subcategory — Admin only
  router.delete('/:catId/subcategories/:subId', ...adminAccessGuards, async (req, res, next) => {
    const { subId } = req.params;
    try {
      await prisma.subCategory.delete({
        where: { id: subId },
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
