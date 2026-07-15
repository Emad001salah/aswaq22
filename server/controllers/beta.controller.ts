/**
 * beta.controller.ts — Beta Operations & Analytics Controller
 *
 * Implements Sprint 6 requirements:
 *   - Beta requests, invitations, and activation
 *   - Feature flag administration
 *   - Real-time product KPI analytics summary
 *   - Client-side event tracking endpoint
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../src/lib/prisma.ts';
import { authMiddleware, rolesGuard, AuthenticatedRequest } from '../middleware/auth.ts';
import { trackEvent, AnalyticsEventType, getAnalyticsSummary, AnalyticsEvent } from '../lib/analytics.ts';
import { featureFlags, FLAGS } from '../lib/featureFlags.ts';

export const BetaController = (): Router => {
  const router = Router();

  // ─── A. Public Beta Routes ──────────────────────────────────────────────────

  // 1. Request a beta invitation
  router.post('/beta/request', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, phone } = req.body;
      if (!email && !phone) {
        return res.status(400).json({
          success: false,
          error: 'Missing fields',
          message: 'يجب تقديم البريد الإلكتروني أو رقم الهاتف لطلب الدعوة.',
        });
      }

      // Create pending invitation
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // expires in 7 days

      const invite = await prisma.betaInvitation.create({
        data: {
          email,
          phone,
          status: 'PENDING',
          expiresAt,
          notes: 'User requested via public beta form',
        },
      });

      // Track request
      await trackEvent(AnalyticsEventType.BETA_REQUESTED, req, { email, phone });

      res.status(201).json({
        success: true,
        message: 'تم استقبال طلبك للدعوة التجريبية بنجاح.',
        data: {
          code: invite.code, // in real production, we mail/sms this, but for testing we return it
          expiresAt: invite.expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 2. Activate beta invitation code
  router.post('/beta/activate', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { code } = req.body;
      const userId = req.user?.id;

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Missing code',
          message: 'يرجى تقديم رمز الدعوة لتفعيل حسابك.',
        });
      }

      const invite = await prisma.betaInvitation.findUnique({
        where: { code },
      });

      if (!invite) {
        return res.status(404).json({
          success: false,
          error: 'Invalid code',
          message: 'رمز الدعوة هذا غير صالح.',
        });
      }

      if (invite.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          error: 'Code already used',
          message: `رمز الدعوة هذا تم ${invite.status === 'ACTIVATED' ? 'تفعيله مسبقاً' : 'إلغاؤه أو انتهت صلاحيته'}.`,
        });
      }

      if (invite.expiresAt < new Date()) {
        await prisma.betaInvitation.update({
          where: { id: invite.id },
          data: { status: 'EXPIRED' },
        });
        return res.status(400).json({
          success: false,
          error: 'Expired code',
          message: 'رمز الدعوة هذا انتهت صلاحيته.',
        });
      }

      // Activate invitation
      await prisma.$transaction([
        prisma.betaInvitation.update({
          where: { id: invite.id },
          data: {
            status:      'ACTIVATED',
            activatedBy: userId,
            activatedAt: new Date(),
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: {
            isVerified: 'verified', // marks them as verified beta user
          },
        }),
      ]);

      // Track activation
      await trackEvent(AnalyticsEventType.BETA_ACTIVATED, req, { code, userId });

      res.json({
        success: true,
        message: 'تهانينا! تم تفعيل حسابك التجريبي بنجاح.',
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. Get all feature flags for the current user
  /**
   * @openapi
   * /flags:
   *   get:
   *     summary: Get all feature flags for the current user
   *     tags: [Beta]
   *     responses:
   *       200:
   *         description: Feature flags status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 flags:
   *                   type: object
   *                   additionalProperties:
   *                     type: boolean
   */
  router.get('/flags', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keys = Object.values(FLAGS);
      const results: Record<string, boolean> = {};
      for (const key of keys) {
        results[key] = await req.flags.isEnabled(key);
      }
      res.json({ success: true, flags: results });
    } catch (err) {
      next(err);
    }
  });

  // ─── B. Client-side Event Tracking Endpoint ───────────────────────────────

  router.post('/analytics/event', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { event, properties } = req.body;

      if (!event) {
        return res.status(400).json({
          success: false,
          error: 'Missing event name',
        });
      }

      // Validate event type
      const validEvents = Object.values(AnalyticsEventType) as string[];
      if (!validEvents.includes(event)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid event name',
        });
      }

      await trackEvent(event as AnalyticsEvent, req, properties);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ─── C. Admin Routes (Admin role only) ──────────────────────────────────────

  const adminGuards = [authMiddleware, rolesGuard(['ADMIN'])];

  // 1. Get all beta invitations
  router.get('/admin/beta/invitations', adminGuards, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const invites = await prisma.betaInvitation.findMany({
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: invites });
    } catch (err) {
      next(err);
    }
  });

  // 2. Generate a new invitation code
  router.post('/admin/beta/invitations', adminGuards, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { email, phone, notes, days } = req.body;
      const adminId = req.user?.id;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (days || 14)); // default 14 days expiration for admin invites

      const invite = await prisma.betaInvitation.create({
        data: {
          email,
          phone,
          notes,
          invitedBy: adminId,
          expiresAt,
        },
      });

      res.status(201).json({
        success: true,
        message: 'تم توليد رمز الدعوة بنجاح.',
        data: invite,
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. List all Feature Flags
  router.get('/admin/flags', adminGuards, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const flags = await prisma.featureFlag.findMany({
        orderBy: { key: 'asc' },
      });
      res.json({ success: true, data: flags });
    } catch (err) {
      next(err);
    }
  });

  // 4. Update a Feature Flag
  router.put('/admin/flags/:key', adminGuards, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { key } = req.params;
      const { enabled, rolloutPct, allowedUsers } = req.body;

      const flag = await prisma.featureFlag.findUnique({ where: { key } });
      if (!flag) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'ميزة العلم هذه غير موجودة.',
        });
      }

      const updated = await prisma.featureFlag.update({
        where: { key },
        data: {
          enabled:      enabled !== undefined ? enabled : flag.enabled,
          rolloutPct:   rolloutPct !== undefined ? rolloutPct : flag.rolloutPct,
          allowedUsers: allowedUsers !== undefined ? allowedUsers : flag.allowedUsers,
        },
      });

      // Audit Log for release control
      await prisma.adminLog.create({
        data: {
          adminId: req.user!.id,
          action: 'UPDATE_FEATURE_FLAG',
          details: JSON.stringify({
            flagKey: key,
            oldValue: {
              enabled: flag.enabled,
              rolloutPct: flag.rolloutPct,
              allowedUsers: flag.allowedUsers,
            },
            newValue: {
              enabled: updated.enabled,
              rolloutPct: updated.rolloutPct,
              allowedUsers: updated.allowedUsers,
            },
            correlationId: req.correlationId,
          }),
          ipAddress: req.ip,
        }
      });

      // Clear the local cache for this flag
      featureFlags.invalidate(key);

      res.json({
        success: true,
        message: 'تم تحديث ميزة العلم بنجاح.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── E. Geocoding Proxy Routes (bypasses browser CORS & OSM Agent blocks) ───

  // 1. Reverse Geocoding Proxy
  router.get('/geocode/reverse', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lat, lon, lang } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ success: false, error: 'Missing coordinates' });
      }
      
      const targetLang = lang || 'ar';
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=${targetLang}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AswaqApp/2.0 (contact@aswaq22.com; localhost geocode proxy)'
        }
      });
      
      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: 'OSM Geocode error' });
      }
      
      const data = await response.json();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  });

  // 2. Search Autocomplete Proxy – Photon (primary) + Nominatim (fallback)
  router.get('/geocode/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, lang, lat, lon, countrycodes } = req.query;
      if (!q) {
        return res.status(400).json({ success: false, error: 'Missing query' });
      }

      const query = String(q);
      const targetLang = String(lang || 'ar');
      const headers = { 'User-Agent': 'AswaqApp/2.0 (contact@aswaq22.com; production geocode proxy)' };
      const latF = lat ? parseFloat(String(lat)) : null;
      const lonF = lon ? parseFloat(String(lon)) : null;

      // ── 1. Try Photon (Komoot) – best POI coverage for Arabic local places ──
      try {
        let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10&lang=default`;
        if (latF !== null && lonF !== null) {
          photonUrl += `&lat=${latF}&lon=${lonF}`;
        }

        const photonRes = await fetch(photonUrl, { headers, signal: AbortSignal.timeout(5000) });
        if (photonRes.ok) {
          const photonData = await photonRes.json();
          const features: any[] = photonData?.features || [];

          // Normalize Photon GeoJSON features into Nominatim-compatible shape
          const normalized = features
            .filter((f: any) => f.geometry?.coordinates && f.properties)
            .map((f: any) => {
              const p = f.properties;
              const [pLon, pLat] = f.geometry.coordinates;
              const nameParts = [p.name, p.street, p.city, p.country].filter(Boolean);
              return {
                place_id: `photon-${p.osm_id || Math.random()}`,
                lat: String(pLat),
                lon: String(pLon),
                name: p.name || '',
                display_name: nameParts.join(', '),
                type: p.type || p.osm_value || '',
                address: {
                  amenity: p.name,
                  road: p.street,
                  city: p.city,
                  country: p.country,
                  country_code: p.countrycode,
                },
              };
            })
            // Filter by country code if provided
            .filter((r: any) => {
              if (!countrycodes) return true;
              const cc = String(countrycodes).toLowerCase();
              return (r.address?.country_code || '').toLowerCase() === cc;
            });

          if (normalized.length > 0) {
            return res.json({ success: true, data: normalized });
          }
        }
      } catch (photonErr) {
        console.warn('[Photon] Failed, falling back to Nominatim:', photonErr);
      }

      // ── 2. Fallback: Nominatim with optional viewbox ──
      const baseParams = `format=json&q=${encodeURIComponent(query)}&accept-language=${targetLang}&limit=10&addressdetails=1`;
      let nomUrl = `https://nominatim.openstreetmap.org/search?${baseParams}`;
      if (latF !== null && lonF !== null) {
        const delta = 0.5;
        nomUrl += `&viewbox=${lonF - delta},${latF - delta},${lonF + delta},${latF + delta}`;
      }
      if (countrycodes) {
        nomUrl += `&countrycodes=${countrycodes}`;
      }

      const nomRes = await fetch(nomUrl, { headers, signal: AbortSignal.timeout(5000) });
      if (!nomRes.ok) {
        return res.status(nomRes.status).json({ success: false, error: 'Geocode search failed' });
      }

      let data = await nomRes.json();

      // If constrained search returned nothing, try globally
      if (Array.isArray(data) && data.length === 0 && (latF !== null || countrycodes)) {
        const globalUrl = `https://nominatim.openstreetmap.org/search?${baseParams}`;
        const globalRes = await fetch(globalUrl, { headers, signal: AbortSignal.timeout(5000) });
        if (globalRes.ok) {
          data = await globalRes.json();
        }
      }

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  });

  // 3. Driving Route Proxy
  router.get('/geocode/route', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { path } = req.query;
      if (!path) {
        return res.status(400).json({ success: false, error: 'Missing path query parameter' });
      }

      const url = `https://router.project-osrm.org/route/v1/driving/${encodeURIComponent(String(path))}?overview=full&geometries=geojson`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AswaqApp/2.0 (contact@aswaq22.com; production geocode proxy)'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: 'OSM Route error' });
      }

      const data = await response.json();
      res.json(data); // Return the raw OSRM JSON directly for seamless frontend integration
    } catch (err) {
      next(err);
    }
  });

  // 5. Analytics Summary dashboard
  router.get('/admin/analytics/summary', adminGuards, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const days = parseInt(req.query.days as string, 10) || 7;
      const summary = await getAnalyticsSummary(days);
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
