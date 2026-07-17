import { Router } from 'express';
import { prisma } from '../../src/lib/prisma.ts';

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
    if (!id || !nameAr || !nameEn || !icon) {
      return res.status(400).json({ error: 'Missing required category fields' });
    }
    try {
      const category = await prisma.category.create({
        data: { id, nameAr, nameEn, icon },
      });
      res.status(201).json(category);
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/categories/:id - Update Category — Admin only
  router.put('/:id', ...adminAccessGuards, async (req, res, next) => {
    const { id } = req.params;
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
    const { id } = req.params;
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
