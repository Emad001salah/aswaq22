import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { RedisService } from "../../redis.service";
import { searchEngine } from "../../../lib/meilisearch";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { getDeterministicUuid, getLegacyName } from "../../../../server/utils/db-helpers";

@Injectable()
export class AdsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private eventEmitter: EventEmitter2
  ) {}

  async findAll(params: { category?: string; subCategory?: string; city?: string; q?: string; cursor?: string; limit?: number }) {
    const { category, subCategory, city, q, cursor, limit = 20 } = params;
    const cacheKey = `ads:${category || "all"}:${subCategory || "all"}:${city || "all"}:${q || "none"}:cursor=${cursor || "none"}:limit=${limit}`;
    
    try {
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        console.log("Serving ads from Redis cache:", cacheKey);
        return JSON.parse(cachedData);
      }
    } catch (e) {
      console.error("Redis cache hit error:", e);
    }

    let adsRaw: any[] = [];
    let usedMeili = false;
    const pagination: any = {
      take: limit + 1,
    };
    if (cursor) {
      pagination.cursor = { id: cursor };
      pagination.skip = 1;
    }

    if (q && searchEngine.isAvailable()) {
      const meiliResults = await searchEngine.search(q, { city, category }, 50);
      if (meiliResults) {
        usedMeili = true;
        const meiliIds = meiliResults.map((r: any) => r.id);
        const dbAds = await this.prisma.ad.findMany({
          where: { id: { in: meiliIds } },
          include: { user: true, images: { orderBy: { sortOrder: "asc" } } }
        });
        adsRaw = meiliIds.map((id: string) => dbAds.find(ad => ad.id === id)).filter(Boolean);
      }
    }

    if (!usedMeili) {
      adsRaw = await this.prisma.ad.findMany({
        where: {
          AND: [
            category ? { categoryId: getDeterministicUuid(category) } : {},
            subCategory ? { subCategoryId: getDeterministicUuid(subCategory) } : {},
            city ? { city } : {},
            q ? {
              OR: [
                { title: { contains: q } },
                { description: { contains: q } },
              ],
            } : {}
          ]
        },
        include: { user: true, images: { orderBy: { sortOrder: "asc" } } },
        orderBy: { createdAt: "desc" },
        ...pagination,
      });
    }

    let nextCursor: string | undefined = undefined;
    if (adsRaw.length > limit) {
      const nextItem = adsRaw[limit];
      nextCursor = nextItem.id;
      adsRaw = adsRaw.slice(0, limit);
    }
    const ads = adsRaw.map(ad => ({
      ...ad,
      category: getLegacyName(ad.categoryId) || "",
      subCategory: getLegacyName(ad.subCategoryId) || null,
      status: ad.status.toLowerCase(),
      images: ad.images?.map((i: any) => i.url) || []
    }));

    try {
      await this.redis.set(cacheKey, JSON.stringify({ ads, nextCursor }), 10);
    } catch (e) {
      console.error("Redis cache set error:", e);
    }
    
    return { ads, nextCursor };
  }

  async findOne(id: string) {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      include: { user: true, images: { orderBy: { sortOrder: "asc" } } },
    });
    if (ad) {
      return { 
        ...ad, 
        category: getLegacyName(ad.categoryId) || "",
        subCategory: getLegacyName(ad.subCategoryId) || null,
        status: ad.status.toLowerCase(),
        images: ad.images?.map((i: any) => i.url) || [] 
      };
    }
    return null;
  }

  async create(data: any) {
    const { images, userId, title, description, price, currency, category, subCategory, city, district, showOnMap, latitude, longitude, videoUrl } = data;
    
    if (userId) {
      const userUuid = getDeterministicUuid(userId);
      const userCount = await this.prisma.user.count({ where: { id: userUuid } });
      if (userCount === 0) {
        await this.prisma.user.create({
          data: {
            id: userUuid,
            email: `mock_${userId}@example.com`,
            name: "Demo User",
            password: "mock_password",
            role: "USER",
            avatar: null
          }
        });
      }
    }

    const payload: any = {
      title, description, currency, city, district, showOnMap, latitude, longitude, videoUrl,
      price: parseFloat(price || "0"),
      userId: userId ? getDeterministicUuid(userId) : undefined,
      images: {
        create: (images || []).map((url: string, idx: number) => ({ url, sortOrder: idx }))
      },
      status: "ACTIVE",
    };

    if (category) {
      payload.categoryId = getDeterministicUuid(category);
    }
    if (subCategory) {
      payload.subCategoryId = getDeterministicUuid(subCategory);
    }
    
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    const ad = await this.prisma.ad.create({
      data: payload,
      include: { user: true, images: { orderBy: { sortOrder: "asc" } } }
    });
    const result = { 
      ...ad, 
      category: getLegacyName(ad.categoryId) || "",
      subCategory: getLegacyName(ad.subCategoryId) || null,
      status: ad.status.toLowerCase(),
      images: ad.images?.map((i: any) => i.url) || [] 
    };
    
    searchEngine.indexAd({
      id: result.id,
      title: result.title,
      description: result.description,
      city: result.city,
      price: result.price,
      category: result.category,
      status: result.status
    });

    return result;
  }

  async update(id: string, data: any) {
    const { status, title, description, price, currency, category, subCategory, city, district, showOnMap, latitude, longitude, videoUrl, images } = data;
    const updateData: any = { title, description, currency, city, district, showOnMap, latitude, longitude, videoUrl };

    if (category) {
      updateData.categoryId = getDeterministicUuid(category);
    }
    if (subCategory) {
      updateData.subCategoryId = getDeterministicUuid(subCategory);
    }
    if (images) {
      updateData.images = {
        deleteMany: {},
        create: images.map((url: string, idx: number) => ({ url, sortOrder: idx }))
      };
    }
    if (status) {
      updateData.status = status.toUpperCase();
    }
    if (price !== undefined) {
      updateData.price = parseFloat(price);
    }

    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updated = await this.prisma.ad.update({
      where: { id },
      data: updateData,
      include: { user: true, images: { orderBy: { sortOrder: "asc" } } }
    });

    const result = {
      ...updated,
      category: getLegacyName(updated.categoryId) || "",
      subCategory: getLegacyName(updated.subCategoryId) || null,
      status: updated.status.toLowerCase(),
      images: updated.images?.map((i: any) => i.url) || []
    };

    searchEngine.indexAd({
      id: result.id,
      title: result.title,
      description: result.description,
      city: result.city,
      price: result.price,
      category: result.category,
      status: result.status
    });

    return result;
  }

  async remove(id: string) {
    await this.prisma.ad.delete({
      where: { id }
    });
    
    searchEngine.deleteAd(id);
    this.eventEmitter.emit("ad.deleted", { id });
    
    return { success: true, id };
  }

  async moderate(id: string, status: string, isFeatured?: boolean) {
    const data: any = { status: status.toUpperCase() };
    if (isFeatured !== undefined) {
      data.isFeatured = isFeatured;
    }
    const ad = await this.prisma.ad.update({
      where: { id },
      data,
      include: { user: true, images: { orderBy: { sortOrder: "asc" } } }
    });
    return {
      ...ad,
      category: getLegacyName(ad.categoryId) || "",
      subCategory: getLegacyName(ad.subCategoryId) || null,
      status: ad.status.toLowerCase(),
      images: ad.images?.map((i: any) => i.url) || []
    };
  }
}
