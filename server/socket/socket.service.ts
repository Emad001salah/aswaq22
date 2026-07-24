/**
 * server/socket/socket.service.ts
 *
 * Socket.io Realtime Stream & Chat Handler with Redis Adapter support for Horizontal Scaling
 *
 * Scaling Architecture (2026-07-22):
 *  - Extracted socket logic from app.ts into an isolated service.
 *  - Supports multi-node WebSockets using Redis Pub/Sub adapter for multi-server scaling.
 */

import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { prisma } from '../../src/lib/prisma.ts';
import { logger } from '../lib/logger.ts';

export class SocketService {
  private io: Server;
  private activeStreams = new Map<
    string,
    {
      broadcasterId: string;
      viewers: Set<string>;
      pinnedProduct?: { id: string; title: string; price: number; image: string } | null;
    }
  >();

  constructor(io: Server) {
    this.io = io;
    this.setupRedisAdapterIfAvailable();
  }

  /**
   * Configures Redis Adapter for multi-instance Socket.io scaling if Redis is configured.
   */
  private async setupRedisAdapterIfAvailable(): Promise<void> {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD || undefined;

    if (process.env.NODE_ENV === 'test') return;

    try {
      // @ts-ignore - optional module
      const adapterModule = await import('@socket.io/redis-adapter').catch(() => null);
      if (!adapterModule) {
        logger.info('[SocketService] Single-instance mode active (Redis Adapter package optional).');
        return;
      }

      const { createAdapter } = adapterModule;
      const pubClient = new Redis({ host: redisHost, port: redisPort, password: redisPassword, lazyConnect: true });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.io.adapter(createAdapter(pubClient, subClient));
      logger.info('[SocketService] ✅ Socket.io Redis Adapter connected. Multi-node real-time cluster active.');
    } catch (err: any) {
      logger.warn(`[SocketService] Socket.io Redis Adapter fallback to single-instance mode: ${err.message}`);
    }
  }

  public initializeHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info({ message: `WebSocket connected: ${socket.id}` });

      socket.on('join-room', (roomId: string) => {
        socket.join(roomId);
      });

      socket.on('leave-room', (roomId: string) => {
        socket.leave(roomId);
      });

      socket.on('join-stream', (data: { streamId: string; role: 'broadcaster' | 'viewer'; sellerName?: string; adTitle?: string }) => {
        const { streamId, role } = data;
        socket.join(`stream_${streamId}`);

        let stream = this.activeStreams.get(streamId);
        if (!stream) {
          stream = { broadcasterId: '', viewers: new Set() };
          this.activeStreams.set(streamId, stream);
        }

        if (role === 'broadcaster') {
          // Clear any pending disconnect timeout for reconnection
          const pendingTimeout = (stream as any).disconnectTimeout;
          if (pendingTimeout) {
            clearTimeout(pendingTimeout);
            delete (stream as any).disconnectTimeout;
            console.log(`[Stream] Broadcaster reconnected to stream ${streamId}. Cleared disconnect timeout.`);
          }

          stream.broadcasterId = socket.id;
          this.io.to(`stream_${streamId}`).emit('broadcaster-ready', { broadcasterId: socket.id });
          this.io.to(`stream_${streamId}`).emit('stream-broadcaster-online', { broadcasterId: socket.id });

          socket.broadcast.emit('live-stream-notification', {
            streamId,
            sellerName: data.sellerName || 'تاجر',
            adTitle: data.adTitle || 'بث مباشر جديد',
          });

          // Fetch the actual database reel and broadcast the full object as 'new-broadcast'
          prisma.reel.findUnique({
            where: { id: streamId },
            include: { user: { select: { name: true, avatar: true } } }
          }).then(dbReel => {
            if (dbReel) {
              const parts = dbReel.videoUrl.split('||');
              const videoUrlParsed = parts[0] || '';
              const audioUrlParsed = parts[1] && parts[1] !== 'none' ? parts[1] : '';
              const descParsed = parts[2] || '';
              const cityParsed = parts[3] || 'كافة المناطق';
              const catParsed = parts[4] || 'عام';

              const formattedAd = {
                id: dbReel.id,
                isPromo: true,
                promoType: "db",
                title: dbReel.title,
                category: catParsed,
                city: cityParsed,
                price: 0,
                currency: 'YER',
                description: descParsed,
                createdAt: dbReel.createdAt,
                views: 0,
                likes: 0,
                userId: dbReel.userId,
                userName: dbReel.user?.name || data.sellerName || 'تاجر أسواق',
                userAvatar: dbReel.user?.avatar || '',
                userVerified: true,
                images: ["https://picsum.photos/seed/promo/800/400"],
                videoUrl: videoUrlParsed,
                audioUrl: audioUrlParsed,
                isLive: true,
                features: [
                  "موثق وبث حي تفاعلي",
                  "تواصل مباشر وبدون عمولات"
                ],
                ctaText: "استكشف العرض"
              };

              this.io.emit('new-broadcast', formattedAd);
            }
          }).catch(err => {
            console.error('[Socket] Failed to broadcast new-broadcast event:', err);
          });
        } else {
          stream.viewers.add(socket.id);
          if (stream.broadcasterId) {
            this.io.to(stream.broadcasterId).emit('viewer-joined', { viewerId: socket.id });
          }
          if (stream.pinnedProduct) {
            socket.emit('product-pinned', {
              productId: stream.pinnedProduct.id,
              productTitle: stream.pinnedProduct.title,
              productPrice: stream.pinnedProduct.price,
              productImage: stream.pinnedProduct.image,
            });
          }
          this.io.to(`stream_${streamId}`).emit('viewer-count-update', { count: stream.viewers.size });
        }
      });

      socket.on('signal', (data: { to: string; signal: any }) => {
        this.io.to(data.to).emit('signal', {
          from: socket.id,
          signal: data.signal,
        });
      });

      socket.on('stream-filter-change', (data: { streamId: string; filterId: string }) => {
        socket.to(`stream_${data.streamId}`).emit('stream-filter-change', { filterId: data.filterId });
      });

      socket.on('chat-message', (data: { streamId: string; userName: string; text: string; avatar?: string; userId?: string }) => {
        const chatMsg = {
          id: `live_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user: data.userName || 'زائر',
          text: data.text,
          avatar: data.avatar || '',
          userId: data.userId || 'guest',
          timestamp: new Date().toISOString(),
        };
        this.io.to(`stream_${data.streamId}`).emit('chat-message', chatMsg);
      });

      socket.on('live-heart', (data: { streamId: string; color: string; left: number; scale: number }) => {
        this.io.to(`stream_${data.streamId}`).emit('live-heart', {
          id: Date.now() + Math.random(),
          color: data.color,
          left: data.left,
          scale: data.scale,
        });
      });

      socket.on('pin-product', (data: { streamId: string; productId: string | null; productTitle?: string; productPrice?: number; productImage?: string }) => {
        const stream = this.activeStreams.get(data.streamId);
        if (stream) {
          stream.pinnedProduct = data.productId
            ? {
                id: data.productId,
                title: data.productTitle || '',
                price: data.productPrice || 0,
                image: data.productImage || '',
              }
            : null;
        }
        this.io.to(`stream_${data.streamId}`).emit('product-pinned', {
          productId: data.productId,
          productTitle: data.productTitle || '',
          productPrice: data.productPrice || 0,
          productImage: data.productImage || '',
        });
      });

      const autoArchiveStream = async (streamId: string) => {
        try {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(streamId)) {
            return;
          }

          const reel = await prisma.reel.findUnique({ where: { id: streamId } });
          if (reel) {
            const parts = reel.videoUrl.split('||');
            const mainUrl = parts[0];
            if (mainUrl === 'webcam' || mainUrl === 'camera') {
              const archiveVideoUrl = 'https://player.vimeo.com/external/434045526.sd.mp4?s=c19c968f44ff531ae7e77b105021e141aabccb8c&profile_id=165&oauth2_token_id=57447761';
              parts[0] = archiveVideoUrl;
              parts[1] = 'none';
              const updatedUrl = parts.join('||');

              await prisma.reel.update({
                where: { id: streamId },
                data: { videoUrl: updatedUrl },
              });
            }
          }
        } catch (dbErr: any) {
          logger.error({ message: `Socket Auto-archiving stream ${streamId} failed`, error: dbErr });
        }
      };

      socket.on('leave-stream', (data: { streamId: string; role: 'broadcaster' | 'viewer' }) => {
        const { streamId, role } = data;
        socket.leave(`stream_${streamId}`);

        const stream = this.activeStreams.get(streamId);
        if (!stream) return;

        if (role === 'broadcaster') {
          if (stream.broadcasterId === socket.id) {
            this.io.to(`stream_${streamId}`).emit('stream-ended');
            this.activeStreams.delete(streamId);
            autoArchiveStream(streamId);
          }
        } else {
          stream.viewers.delete(socket.id);
          if (stream.broadcasterId) {
            this.io.to(stream.broadcasterId).emit('viewer-left', { viewerId: socket.id });
          }
          this.io.to(`stream_${streamId}`).emit('viewer-count-update', { count: stream.viewers.size });
        }
      });

      socket.on('disconnect', () => {
        for (const [streamId, stream] of this.activeStreams.entries()) {
          if (stream.broadcasterId === socket.id) {
            // Reconnection grace period — 15 seconds before terminating live session
            const timeoutId = setTimeout(() => {
              const currentStream = this.activeStreams.get(streamId);
              if (currentStream && currentStream.broadcasterId === socket.id) {
                this.io.to(`stream_${streamId}`).emit('stream-ended');
                this.activeStreams.delete(streamId);
                autoArchiveStream(streamId);
                console.log(`[Stream] Stream ${streamId} ended/archived after 15s broadcaster disconnect timeout.`);
              }
            }, 15000);
            
            (stream as any).disconnectTimeout = timeoutId;
          } else if (stream.viewers.has(socket.id)) {
            stream.viewers.delete(socket.id);
            if (stream.broadcasterId) {
              this.io.to(stream.broadcasterId).emit('viewer-left', { viewerId: socket.id });
            }
            this.io.to(`stream_${streamId}`).emit('viewer-count-update', { count: stream.viewers.size });
          }
        }
      });
    });
  }
}
