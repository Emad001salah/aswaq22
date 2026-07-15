import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.client = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) return null; // Stop retrying after 3 attempts
            return Math.min(times * 100, 3000);
          },
        });
        this.client.on('error', (err) => {
          console.error('Redis error:', err);
        });
        console.log('Redis initialized with URL:', redisUrl.replace(/\/\/.*@/, '//****@'));
      } catch (error) {
        console.error('Failed to initialize Redis:', error);
      }
    } else {
      console.log('REDIS_URL not found. Caching disabled.');
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }
}
