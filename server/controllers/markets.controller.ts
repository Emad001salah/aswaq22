import { Router } from 'express';
import { prisma } from '../../src/lib/prisma.ts';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MarketsController = (adminAccessGuards: any[]) => {
  const router = Router();

  // GET /api/markets - Fetch all countries and their cities
  router.get('/', async (req, res, next) => {
    try {
      const countries = await prisma.country.findMany({
        include: {
          cities: {
            where: { active: true },
            orderBy: { nameAr: 'asc' }
          }
        },
        orderBy: { labelAr: 'asc' }
      });
      res.json({ success: true, data: countries });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/markets/all - Fetch all countries (including inactive) for Admin UI
  router.get('/all', ...adminAccessGuards, async (req, res, next) => {
    try {
      const countries = await prisma.country.findMany({
        include: {
          cities: {
            orderBy: { nameAr: 'asc' }
          }
        },
        orderBy: { createdAt: 'asc' }
      });
      res.json({ success: true, data: countries });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/markets - Create Country — Admin only
  router.post('/', ...adminAccessGuards, async (req, res, next) => {
    const { countryCode, labelAr, labelEn, currency, usdRate, centerLat, centerLng, flag } = req.body;
    if (!countryCode || !labelAr || !labelEn || !currency) {
      return res.status(400).json({ error: 'Missing required country fields' });
    }
    try {
      const country = await prisma.country.create({
        data: {
          countryCode: countryCode.toUpperCase(),
          labelAr,
          labelEn,
          currency,
          usdRate: parseFloat(usdRate) || 1.0,
          centerLat: parseFloat(centerLat) || 0.0,
          centerLng: parseFloat(centerLng) || 0.0,
          flag: flag || '🌍',
          active: true
        }
      });
      res.status(201).json(country);
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/markets/:id - Update Country — Admin only
  router.put('/:id', ...adminAccessGuards, async (req, res, next) => {
    const { id } = req.params;
    const { labelAr, labelEn, currency, usdRate, centerLat, centerLng, flag, active } = req.body;
    try {
      const country = await prisma.country.update({
        where: { id },
        data: {
          labelAr,
          labelEn,
          currency,
          usdRate: usdRate !== undefined ? parseFloat(usdRate) : undefined,
          centerLat: centerLat !== undefined ? parseFloat(centerLat) : undefined,
          centerLng: centerLng !== undefined ? parseFloat(centerLng) : undefined,
          flag,
          active
        }
      });
      res.json(country);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/markets/:id - Delete Country — Admin only
  router.delete('/:id', ...adminAccessGuards, async (req, res, next) => {
    const { id } = req.params;
    try {
      await prisma.country.delete({
        where: { id }
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/markets/:countryId/cities - Add City — Admin only
  router.post('/:countryId/cities', ...adminAccessGuards, async (req, res, next) => {
    const { countryId } = req.params;
    const { nameAr, nameEn, lat, lng } = req.body;
    if (!nameAr || !nameEn) {
      return res.status(400).json({ error: 'Missing required city fields' });
    }
    try {
      const city = await prisma.city.create({
        data: {
          nameAr,
          nameEn,
          lat: parseFloat(lat) || 0.0,
          lng: parseFloat(lng) || 0.0,
          countryId
        }
      });
      res.status(201).json(city);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/markets/:countryId/cities/:cityId - Delete City — Admin only
  router.delete('/:countryId/cities/:cityId', ...adminAccessGuards, async (req, res, next) => {
    const { cityId } = req.params;
    try {
      await prisma.city.delete({
        where: { id: cityId }
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
