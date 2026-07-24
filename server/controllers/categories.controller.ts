import { Router } from 'express';
import { prisma } from '../../src/lib/prisma.ts';
import { redis } from '../../src/lib/redis.ts';
import { getDeterministicUuid } from '../utils/db-helpers.ts';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES_CACHE_KEY = 'cache:categories:all';
const CATEGORIES_TTL = 600; // 10 minutes — categories rarely change

export const CategoriesController = (adminAccessGuards: any[]) => {
  const router = Router();

  // GET /api/categories - Fetch all categories (Redis cached 10 minutes)
  router.get('/', async (req, res, next) => {
    try {
      // Try Redis cache first
      const cached = await redis.get(CATEGORIES_CACHE_KEY);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.json(JSON.parse(cached));
      }

      const categories = await prisma.category.findMany({
        include: { subCategories: true },
      });
      const responseData = { success: true, data: categories };
      await redis.set(CATEGORIES_CACHE_KEY, JSON.stringify(responseData), CATEGORIES_TTL);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(responseData);
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
      await redis.del(CATEGORIES_CACHE_KEY);
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
      await redis.del(CATEGORIES_CACHE_KEY);
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
      await prisma.category.delete({ where: { id } });
      await redis.del(CATEGORIES_CACHE_KEY);
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
