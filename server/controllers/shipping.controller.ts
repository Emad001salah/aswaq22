/**
 * shipping.controller.ts — Shipping & Logistics API Router & Controller (v2.0)
 *
 * Implements:
 *   - Shipment creation with ETA calculations (EtaEngine)
 *   - Accept P2P assignment with state transition validation
 *   - Strict status updates (ShippingStateMachine)
 *   - Security: driver proximity checking & spoofing protection (GeofencingEngine)
 *   - Deliver verification (OTP, Signature, Photo) with double-entry accounting
 *   - Reverse Logistics: Returns management (ReturnsEngine)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../src/lib/prisma.ts';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.ts';
import { trackEvent, AnalyticsEventType } from '../lib/analytics.ts';
import { CarrierGateway } from '../lib/shipping/carrierGateway.ts';
import { DispatchEngine } from '../lib/shipping/dispatchEngine.ts';
import { AccountingEngine } from '../lib/shipping/accountingEngine.ts';
import { ShippingStateMachine } from '../lib/shipping/stateMachine.ts';
import { EtaEngine } from '../lib/shipping/etaEngine.ts';
import { GeofencingEngine } from '../lib/shipping/geofencing.ts';
import { ReturnsEngine } from '../lib/shipping/returnsEngine.ts';
import { AppError } from '../middleware/error.ts';
import { logger } from '../lib/logger.ts';
import { Server } from 'socket.io';

export const ShippingController = (io?: Server): Router => {
  const router = Router();

  // Feature Flag gate for logistics service
  router.use(authMiddleware);
  router.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.flags && typeof req.flags.isEnabled === 'function') {
        const enabled = (await req.flags.isEnabled('logistics_service')) || process.env.NODE_ENV === 'test';
        const isAdmin = (req as any).user?.role === 'ADMIN' || (req as any).user?.role === 'SUPER_ADMIN';
        if (!enabled && !isAdmin) {
          return res.status(503).json({
            success: false,
            status: 503,
            error: 'Service Unavailable',
            message: 'خدمة التوصيل والشحن قيد التجريب حالياً وسيتم إطلاقها قريباً.',
          });
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/shipping/agents/nearby
  router.get('/agents/nearby', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 15;

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ success: false, message: 'الإحداثيات الجغرافية المطلوبة غير صالحة.' });
      }

      let agentIds = await DispatchEngine.findNearbyAgents(lat, lng, radius);

      // Check if we need to auto-seed demo drivers for local testing / cold-start production
      const totalAvailable = await prisma.deliveryAgent.count({
        where: { status: 'AVAILABLE' }
      });

      const canSeedDemoAgents = process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_SEEDING === 'true';

      if (totalAvailable === 0 && canSeedDemoAgents) {
        const names = ['سند اليماني', 'أحمد القيسي', 'خالد عماد'];
        const vehicles = ['motorcycle', 'car', 'truck'];

        for (let i = 0; i < 3; i++) {
          const email = `driver_demo_${i}_${Date.now()}@aswaq.com`;
          const offsetLat = (Math.random() - 0.5) * 0.015; // ~1.5km radius
          const offsetLng = (Math.random() - 0.5) * 0.015;

          const user = await prisma.user.create({
            data: {
              email,
              name: names[i],
              password: 'hashed_password_demo',
              role: 'USER'
            }
          });

          const agent = await prisma.deliveryAgent.create({
            data: {
              userId: user.id,
              vehicleType: vehicles[i],
              licensePlate: `${Math.floor(10 + Math.random() * 89)}-${Math.floor(1000 + Math.random() * 8999)}`,
              status: 'AVAILABLE',
              currentLat: lat + offsetLat,
              currentLng: lng + offsetLng
            }
          });

          await DispatchEngine.updateAgentLocation(agent.id, lat + offsetLat, lng + offsetLng);
        }

        // Re-run search
        agentIds = await DispatchEngine.findNearbyAgents(lat, lng, radius);
      }

      const agents = await prisma.deliveryAgent.findMany({
        where: {
          id: { in: agentIds },
          status: 'AVAILABLE'
        },
        select: {
          id: true,
          vehicleType: true,
          status: true,
          currentLat: true,
          currentLng: true,
          rating: true,
          user: {
            select: {
              name: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: agents
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── 0. List Shipments ─────────────────────────────────────────────────────
  router.get('/shipments', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const shipments = await prisma.shipment.findMany({
        where: {
          OR: [
            { order: { buyerId: userId } },
            { order: { sellerId: userId } },
            { agent: { userId: userId } }
          ]
        },
        include: {
          order: {
            include: { ad: true }
          },
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        data: shipments
      });
    } catch (err) {
      next(err);
    }
  });
  // ─── 0.5 Create Order & Auto-Generate Shipment ──────────────────────────────
  router.post('/orders', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { adId, quantity = 1, buyerName, buyerPhone } = req.body;
      const buyerId = req.user!.id;

      if (!adId) {
        return res.status(400).json({ success: false, message: 'معرف الإعلان مطلوب.' });
      }

      const ad = await prisma.ad.findUnique({
        where: { id: adId },
        include: { user: true }
      });

      if (!ad) {
        return res.status(404).json({ success: false, message: 'الإعلان غير موجود.' });
      }

      // Create order
      const order = await prisma.order.create({
        data: {
          buyerId,
          sellerId: ad.userId,
          adId,
          quantity: parseInt(String(quantity)) || 1,
          totalPrice: (ad.price || 0) * (parseInt(String(quantity)) || 1),
          status: 'PENDING'
        }
      });

      // Lookup buyer profile for destination coordinates
      const buyerUser = await prisma.user.findUnique({
        where: { id: buyerId },
        select: { city: true, countryId: true }
      });
      const buyerCityKey = (buyerUser?.city || ad.city || 'sanaa').toLowerCase().trim();
      const CITY_COORDS: Record<string, [number, number]> = {
        'sanaa': [15.3694, 44.1910], 'صنعاء': [15.3694, 44.1910],
        'aden': [12.7794, 45.0367], 'عدن': [12.7794, 45.0367],
        'taiz': [13.5789, 44.0177], 'تعز': [13.5789, 44.0177],
        'hodeidah': [14.7978, 42.9545], 'الحديدة': [14.7978, 42.9545],
        'mukalla': [14.5425, 49.1256], 'المكلا': [14.5425, 49.1256],
        'ibb': [13.9769, 44.1872], 'إب': [13.9769, 44.1872],
        'marib': [15.4644, 45.3213], 'مأرب': [15.4644, 45.3213],
        'amman': [31.9539, 35.9106], 'عمان': [31.9539, 35.9106],
        'riyadh': [24.7136, 46.6753], 'الرياض': [24.7136, 46.6753],
        'jeddah': [21.4858, 39.1925], 'جدة': [21.4858, 39.1925],
        'cairo': [30.0444, 31.2357], 'القاهرة': [30.0444, 31.2357],
        'baghdad': [33.3152, 44.3661], 'بغداد': [33.3152, 44.3661],
        'kuwait': [29.3759, 47.9774], 'الكويت': [29.3759, 47.9774]
      };
      const [derivedDeliveryLat, derivedDeliveryLng] = CITY_COORDS[buyerCityKey] || [15.405, 44.225];

      // Compute ETA & Shipping Fee
      const pickupLat = ad.latitude || 15.35;
      const pickupLng = ad.longitude || 44.20;
      const deliveryLat = derivedDeliveryLat;
      const deliveryLng = derivedDeliveryLng;

      const eta = EtaEngine.calculateETA({
        pickupLat,
        pickupLng,
        deliveryLat,
        deliveryLng,
        city: ad.city,
      });

      const basePrice = 1000.0;
      const distanceFee = eta.distanceKm * 100.0;
      const weightFee = order.quantity * 200.0;
      const totalCost = basePrice + distanceFee + weightFee;

      const trackingNumber = `ASQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;

      // Create shipment
      const shipment = await prisma.shipment.create({
        data: {
          orderId: order.id,
          carrierName: 'Aswaq Delivery',
          carrierMethod: 'CARRIER',
          trackingNumber,
          status: 'PENDING',
          basePrice,
          distanceFee,
          weightFee,
          volumeFee: 0,
          totalCost,
          estimatedTime: eta.estimatedArrival,
          pickupLat,
          pickupLng,
          deliveryLat,
          deliveryLng,
        }
      });

      res.status(201).json({
        success: true,
        message: 'تم إنشاء الطلب وبوليسة الشحن بنجاح.',
        order,
        shipment
      });
    } catch (err) {
      next(err);
    }
  });
  router.post('/shipments', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { orderId, carrierMethod, carrierName, weight, width, height, depth, insurance } = req.body;

      if (!orderId || !carrierMethod) {
        throw new AppError(400, 'البيانات المطلوبة لإنشاء الشحنة ناقصة.');
      }

      // Check if order exists
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { ad: true },
      });

      if (!order) {
        throw new AppError(404, 'الطلب المحدد غير موجود.');
      }

      const ad = order.ad;
      const buyerUser = await prisma.user.findUnique({
        where: { id: order.buyerId },
        select: { city: true }
      });
      const buyerCityKey = (buyerUser?.city || ad.city || 'sanaa').toLowerCase().trim();
      const CITY_COORDS: Record<string, [number, number]> = {
        'sanaa': [15.3694, 44.1910], 'صنعاء': [15.3694, 44.1910],
        'aden': [12.7794, 45.0367], 'عدن': [12.7794, 45.0367],
        'taiz': [13.5789, 44.0177], 'تعز': [13.5789, 44.0177],
        'hodeidah': [14.7978, 42.9545], 'الحديدة': [14.7978, 42.9545],
        'mukalla': [14.5425, 49.1256], 'المكلا': [14.5425, 49.1256],
        'ibb': [13.9769, 44.1872], 'إب': [13.9769, 44.1872],
        'marib': [15.4644, 45.3213], 'مأرب': [15.4644, 45.3213],
        'amman': [31.9539, 35.9106], 'عمان': [31.9539, 35.9106],
        'riyadh': [24.7136, 46.6753], 'الرياض': [24.7136, 46.6753],
        'jeddah': [21.4858, 39.1925], 'جدة': [21.4858, 39.1925],
        'cairo': [30.0444, 31.2357], 'القاهرة': [30.0444, 31.2357],
        'baghdad': [33.3152, 44.3661], 'بغداد': [33.3152, 44.3661],
        'kuwait': [29.3759, 47.9774], 'الكويت': [29.3759, 47.9774]
      };
      const [derivedDeliveryLat, derivedDeliveryLng] = CITY_COORDS[buyerCityKey] || [15.405, 44.225];

      const pickupLat = ad.latitude || 15.35;
      const pickupLng = ad.longitude || 44.20;
      const deliveryLat = derivedDeliveryLat;
      const deliveryLng = derivedDeliveryLng;

      // Call ETA Engine
      const eta = EtaEngine.calculateETA({
        pickupLat,
        pickupLng,
        deliveryLat,
        deliveryLng,
        city: ad.city,
      });

      // Calculate fees based on ShippingZone or fallback defaults
      const zone = await prisma.shippingZone.findFirst({
        where: {
          city:     ad.city,
          country:  'YE',
        },
      });

      const basePrice     = zone?.basePrice ?? 1000.0;
      const kmRate        = zone?.kmRate ?? 100.0;
      const distanceFee   = kmRate * eta.distanceKm;
      const weightVal     = weight || 1.0;
      const weightFee     = weightVal * 200.0;
      const volumeVal     = (width || 10) * (height || 10) * (depth || 10);
      const volumeFee     = volumeVal > 1000 ? 500.0 : 0.0;
      const insuranceFee  = insurance ? order.totalPrice * 0.01 : 0.0;
      const codFee        = 300.0;
      const totalCost     = basePrice + distanceFee + weightFee + volumeFee + insuranceFee + codFee;

      const trackingNumber = `ASQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;

      // Create Shipment record
      const shipment = await prisma.shipment.create({
        data: {
          orderId,
          carrierMethod,
          carrierName,
          trackingNumber,
          basePrice,
          distanceFee,
          weightFee,
          volumeFee,
          insuranceFee,
          codFee,
          totalCost,
          codAmount: order.totalPrice + totalCost,
          weight:    weightVal,
          width:     width || 10.0,
          height:    height || 10.0,
          depth:     depth || 10.0,
          status:    'PENDING',
          pickupLat,
          pickupLng,
          deliveryLat,
          deliveryLng,
          estimatedTime: eta.estimatedArrival,
        },
      });

      // Write Outbox Event for background processing / sync
      await prisma.outboxEvent.create({
        data: {
          aggregate:   'Shipment',
          aggregateId: shipment.id,
          eventType:   'CREATED',
          payload:     shipment as any,
          status:      'PENDING',
        },
      });

      // Track event
      await trackEvent(AnalyticsEventType.AD_VIEWED, req, { shipmentId: shipment.id, event: 'shipment_created' });

      res.status(201).json({
        success: true,
        message: 'تم إنشاء الشحنة واحتساب تكاليف التوصيل والوقت المتوقع بنجاح.',
        data:    shipment,
        eta,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── 2. Accept P2P Agent Offer ─────────────────────────────────────────────
  router.post('/shipments/:id/accept', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Find the user's DeliveryAgent profile
      const agent = await prisma.deliveryAgent.findUnique({
        where: { userId },
      });

      if (!agent) {
        throw new AppError(403, 'يجب أن تكون مسجلاً كمندوب توصيل لقبول الطلب.');
      }

      if (agent.status !== 'AVAILABLE') {
        throw new AppError(400, 'حالتك الحالية لا تسمح بقبول طلبات جديدة.');
      }

      const shipment = await prisma.shipment.findUnique({ where: { id } });
      if (!shipment) {
        throw new AppError(404, 'الشحنة المحددة غير موجودة.');
      }

      if (shipment.status !== 'PENDING') {
        throw new AppError(400, 'هذه الشحنة تم قبولها بالفعل أو لم تعد متاحة.');
      }

      // Assign agent
      await prisma.shipment.update({
        where: { id },
        data: { agentId: agent.id },
      });

      // Use state machine to validate and execute transition to WAITING_PICKUP
      const updated = await ShippingStateMachine.transition(id, 'WAITING_PICKUP', {
        userId:      userId!,
        description: `تم قبول الشحنة من المندوب: ${agent.id}`,
        userIp:      req.ip,
        userAgent:   req.headers['user-agent'],
      });

      // Mark agent busy
      await prisma.deliveryAgent.update({
        where: { id: agent.id },
        data:  { status: 'BUSY' },
      });

      res.json({
        success: true,
        message: 'تم قبول مهمة التوصيل وتكليفك بها بنجاح.',
        data:    updated,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── 3. Update Shipment Status (State Machine gated) ──────────────────────
  router.post('/shipments/:id/status', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, description, lat, lng } = req.body;
      const userId = req.user?.id;

      const shipment = await prisma.shipment.findUnique({
        where:   { id },
        include: { order: true },
      });

      if (!shipment) {
        throw new AppError(404, 'الشحنة المحددة غير موجودة.');
      }

      // Check permission: Only assigned agent, seller or admin can update status
      const isSeller = shipment.order.sellerId === userId;
      const isAgent  = shipment.agentId && (await prisma.deliveryAgent.findUnique({ where: { id: shipment.agentId } }))?.userId === userId;
      const isAdmin  = req.user?.role === 'ADMIN';

      if (!isSeller && !isAgent && !isAdmin) {
        throw new AppError(403, 'غير مصرح لك بتحديث حالة هذه الشحنة.');
      }

      if (status === 'DELIVERED') {
        throw new AppError(400, 'لا يمكن تحديث الحالة إلى DELIVERED مباشرة. يرجى استخدام نقطة التحقق من التسليم (verify).');
      }

      // Transition using the state machine (with safety hooks and audit logs)
      const updated = await ShippingStateMachine.transition(id, status, {
        userId:      userId!,
        description: description || `تغيير الحالة إلى ${status}`,
        userIp:      req.ip,
        userAgent:   req.headers['user-agent'],
        lat,
        lng,
      });

      res.json({
        success: true,
        message: 'تم تحديث حالة الشحنة بنجاح عبر نظام التحقق.',
        data:    updated,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── 4. Deliver & Verify Shipment (OTP / Proximity Gated) ──────────────────
  router.post('/shipments/:id/verify', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { method, code, signatureUrl, photoUrl, lat, lng } = req.body;
      const userId = req.user?.id;

      const shipment = await prisma.shipment.findUnique({
        where:   { id },
        include: { order: true },
      });

      if (!shipment) {
        throw new AppError(404, 'الشحنة غير موجودة.');
      }

      // Verify agent identity matches the assigned agent
      const agent = await prisma.deliveryAgent.findUnique({ where: { userId } });
      if (!agent || shipment.agentId !== agent.id) {
        throw new AppError(403, 'فقط المندوب المعين للشحنة يمكنه إتمام التسليم.');
      }

      // Proximity verification (Anti-fraud check)
      if (lat !== undefined && lng !== undefined) {
        const isNear = await GeofencingEngine.verifyLocationBeforeOTP(id, lat, lng);
        if (!isNear) {
          throw new AppError(403, 'تنبيه أمان: محاولة التسليم مرفوضة. المندوب بعيد جداً عن موقع تسليم العميل.');
        }
      }

      // Verify OTP code if chosen method
      if (method === 'OTP') {
        const verification = await prisma.deliveryVerification.findFirst({
          where: { shipmentId: id, method: 'OTP' },
        });

        if (!verification || verification.code !== code) {
          throw new AppError(401, 'رمز التحقق (OTP) غير صحيح.');
        }
      }

      // Record verification
      await prisma.deliveryVerification.create({
        data: {
          shipmentId:   id,
          method,
          signatureUrl,
          photoUrl,
          verifiedAt:   new Date(),
        },
      });

      // Transition to DELIVERED using state machine
      const finalized = await ShippingStateMachine.transition(id, 'DELIVERED', {
        userId:      userId!,
        description: `تسليم الشحنة عبر طريقة: ${method}`,
        userIp:      req.ip,
        userAgent:   req.headers['user-agent'],
        lat,
        lng,
      });

      // Trigger final double-entry ledger payouts & settlements
      await AccountingEngine.recordDeliverySuccess(id);

      // Reset driver status to AVAILABLE
      await prisma.deliveryAgent.update({
        where: { id: agent.id },
        data:  { status: 'AVAILABLE' },
      });

      res.json({
        success: true,
        message: 'تم التحقق من إثبات التسليم بنجاح وجاري تسوية الحسابات المالية.',
        data:    finalized,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── 5. Driver GPS Location Update with Spoofing Protection ───────────────
  router.post('/shipments/agent/location', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { lat, lng } = req.body;
      const userId = req.user?.id;

      if (lat === undefined || lng === undefined) {
        throw new AppError(400, 'الإحداثيات الجغرافية مطلوبة.');
      }

      const agent = await prisma.deliveryAgent.findUnique({
        where: { userId },
      });

      if (!agent) {
        throw new AppError(403, 'غير مصرح. الحساب غير مسجل كمندوب.');
      }

      // Run Fraud detection (Location Spoofing check)
      const isSpoofed = await GeofencingEngine.detectLocationSpoofing(agent.id, lat, lng);
      if (isSpoofed) {
        throw new AppError(400, 'تم رفض تحديث الموقع: تم رصد سرعة انتقالية غير معقولة (احتمالية تزييف الإحداثيات).');
      }

      // Update location (Redis GEO + DB)
      await DispatchEngine.updateAgentLocation(agent.id, lat, lng);

      // Perform geofence auto-transitions
      const activeShipments = await prisma.shipment.findMany({
        where: {
          agentId: agent.id,
          status:  { in: ['WAITING_PICKUP', 'OUT_FOR_DELIVERY'] },
        },
      });

      for (const shipment of activeShipments) {
        await GeofencingEngine.checkGeofenceAndTransition(shipment.id, lat, lng);
        if (io) {
          logger.info(`[Socket] Broadcasting driver location to room ${shipment.id}: ${lat}, ${lng}`);
          io.to(shipment.id).emit('driver-location-update', { lat, lng });
        }
      }
      res.json({
        success: true,
        message: 'تم تحديث الموقع وتدقيق السياج الجغرافي بنجاح.',
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── 6. Reverse Logistics (Returns Engine) ────────────────────────────────
  router.post('/shipments/:id/return/request', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;

      if (!reason) {
        throw new AppError(400, 'يجب تقديم سبب لطلب الإرجاع.');
      }

      const result = await ReturnsEngine.requestReturn(id, reason, userId!);

      res.json({
        success: true,
        message: 'تم تقديم طلب الإرجاع بنجاح وبانتظار الموافقة.',
        data:    result,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/shipments/:id/return/finalize', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Only merchant (seller) or admin can finalize returns
      const shipment = await prisma.shipment.findUnique({
        where:   { id },
        include: { order: true },
      });

      if (!shipment) {
        throw new AppError(404, 'الشحنة غير موجودة.');
      }

      const isSeller = shipment.order.sellerId === userId;
      const isAdmin  = req.user?.role === 'ADMIN';

      if (!isSeller && !isAdmin) {
        throw new AppError(403, 'غير مصرح لك بقبول وتأكيد إرجاع الشحنة.');
      }

      const result = await ReturnsEngine.finalizeReturn(id, userId!);

      res.json({
        success: true,
        message: 'تم استلام المرتجع وإرجاع رصيد المشتري وتحديث المخزون بنجاح.',
        data:    result,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
