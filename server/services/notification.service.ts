/**
 * server/services/notification.service.ts
 * 
 * Notification & FCM Push Service for Aswaq Platform
 */

import { prisma } from '../../src/lib/prisma.ts';
import { logger } from '../lib/logger.ts';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, string>;
}

export class NotificationService {
  /**
   * Save user FCM Push Token in DB/Redis
   */
  public static async registerDeviceToken(userId: string, token: string, platform: string = 'web') {
    try {
      if (!userId || !token) return;
      
      // Store notification setting / token
      await prisma.user.update({
        where: { id: userId },
        data: {
          permissions: {
            pushToken: token,
            platform,
            registeredAt: new Date().toISOString(),
          } as any
        }
      }).catch(() => null);

      logger.info({ message: `Push token registered for user ${userId}` });
    } catch (err: any) {
      logger.error({ message: `Failed registering push token: ${err.message}` });
    }
  }

  /**
   * Send Push Notification to a user (via FCM REST API if FIREBASE_SERVER_KEY is configured, or broadcast)
   */
  public static async sendPushToUser(userId: string, payload: PushPayload) {
    try {
      // 1. Create in-app Notification record in Prisma DB
      const inAppNotification = await prisma.notification.create({
        data: {
          userId,
          title: payload.title,
          content: payload.body,
          type: 'SYSTEM',
        }
      }).catch(() => null);

      // 2. Check if FCM Server Key or Web Push key is set
      const fcmKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY;
      if (fcmKey) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { permissions: true }
        });
        const pushToken = (user?.permissions as any)?.pushToken;
        if (pushToken) {
          await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Authorization': `key=${fcmKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: pushToken,
              notification: {
                title: payload.title,
                body: payload.body,
                icon: payload.icon || '/icon.png',
              },
              data: payload.data || {},
            }),
          }).catch(err => logger.error({ message: `FCM push error: ${err.message}` }));
        }
      }

      logger.info({ message: `Push notification sent to user ${userId}: ${payload.title}` });
      return inAppNotification;
    } catch (err: any) {
      logger.error({ message: `Failed sending push notification: ${err.message}` });
      return null;
    }
  }
}
