import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

function getDeterministicUuid(str: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str.toLowerCase();
  }
  const hash = crypto.createHash("sha256").update(str).digest("hex");
  const part1 = hash.substring(0, 8);
  const part2 = hash.substring(8, 12);
  const part3 = "4" + hash.substring(13, 16);
  const part4 = "a" + hash.substring(17, 20);
  const part5 = hash.substring(20, 32);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    this.$connect()
      .then(async () => {
        console.log("Successfully connected to Database via Prisma");
        await this.seedIfNeeded();
      })
      .catch((error) => {
        console.error("Failed to connect to Database via Prisma. Backend will start in limited mode.", error);
      });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async seedIfNeeded() {
    try {
      const userCount = await this.user.count();
      if (userCount === 0) {
        console.log("Database is empty. Seeding initial users...");
        
        const users = [
          {
            id: getDeterministicUuid("user_1"),
            email: "ahmed@souqye.com",
            name: "ÃÈæ ÃÍãÏ ÇáåãÏÇäí",
            phone: "777123456",
            password: "default-password-preview",
            avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
            role: "USER" as const,
          },
          {
            id: getDeterministicUuid("user_2"),
            email: "moraissi@souqye.com",
            name: "ãÌãæÚÉ ÇáãÑíÓí ÇáÚÞÇÑíÉ",
            phone: "733987654",
            password: "default-password-preview",
            avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80",
            role: "USER" as const,
          },
          {
            id: getDeterministicUuid("user_3"),
            email: "salem@souqye.com",
            name: "ÓÇáã ÇáÍÖÑãí",
            phone: "700112233",
            password: "default-password-preview",
            avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
            role: "USER" as const,
          },
          {
            id: getDeterministicUuid("user_admin"),
            email: "admin@souqye.com",
            name: "ÇáãÏíÑ ÇáÚÇã ááãäÕÉ",
            phone: "770000000",
            password: "default-password-preview",
            avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80",
            role: "ADMIN" as const,
          }
        ];

        for (const u of users) {
          await this.user.upsert({
            where: { id: u.id },
            update: {},
            create: u
          });
        }
        console.log("Initial users seeded successfully.");
      }

      const adCount = await this.ad.count();
      if (adCount === 0) {
        console.log("Seeding initial ads...");
        
        const initialAds = [
          {
            id: getDeterministicUuid("ad_1"),
            title: "ÊæíæÊÇ åíáæßÓ 2023 ÏÈá ÎáíÌí ßÑÊ",
            description: "ÊæíæÊÇ åíáæßÓ ãæÏíá 2023 ÏÈá¡ ãæÇÕÝÇÊ ÚÇáíÉ ÌÏÇð¡ ÌíÑ ÚÇÏí¡ ÈäÒíä¡ ÞØÚÊ ãÓÇÝÉ 15,000 ßã ÝÞØ. ÇáÓíÇÑÉ äÙíÝÉ ÎÇáíÉ ãä ÇáÍæÇÏË æÇáÑÔ¡ ãÌãÑßÉ æãÑÞãÉ ÌÇåÒÉ Ýí ÕäÚÇÁ. ÊßííÝ ããÊÇÒ¡ ÔÇÔÉ ÐßíÉ¡ ßÇãíÑÇ ÎáÝíÉ¡ ÍÓÇÓÇÊ.",
            price: 32500,
            currency: "USD",
            city: "sanaa_city",
            district: "sanaa_hadda",
            categoryId: getDeterministicUuid("cars"),
            images: {
              create: [
                "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80",
                "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80"
              ].map((url, i) => ({ url, sortOrder: i }))
            },
            status: "ACTIVE" as const,
            userId: getDeterministicUuid("user_1")
          },
          {
            id: getDeterministicUuid("ad_2"),
            title: "ÔÞÉ ÝÇÎÑÉ ááÈíÚ Ýí ÚÏä - ãÎØØ ßÇÈæÊÇ ÇáããíÒ",
            description: "ÔÞÉ ÓßäíÉ ÝÇÎÑÉ ÊÊßæä ãä 4 ÛÑÝ æÕÇáÉ æÇÓÚÉ æÍãÇãíä æãØÈÎ¡ ÇáØÇÈÞ ÇáËÇáË¡ ÊÔØíÈ ÓæÈÑ ÏíáæßÓ¡ ÌÕ ãÛÑÈí¡ ÅäÇÑÉ ÍÏíËÉ¡ ÎÒÇä ãíÇå ãÓÊÞá. ÊÞÚ Ýí ãæÞÚ ÇÓÊÑÇÊíÌí ÞÑíÈ ãä ßÇÝÉ ÇáÎÏãÇÊ ÇáÚÇãÉ æÇáãÏÇÑÓ.",
            price: 65000,
            currency: "USD",
            city: "aden",
            district: "aden_mansoura",
            categoryId: getDeterministicUuid("realestate"),
            images: {
              create: [
                "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=400&q=80",
                "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80"
              ].map((url, i) => ({ url, sortOrder: i }))
            },
            status: "ACTIVE" as const,
            userId: getDeterministicUuid("user_2")
          },
          {
            id: getDeterministicUuid("ad_3"),
            title: "ÌåÇÒ ÂíÝæä 15 ÈÑæ ãÇßÓ ÑãÇÏí ÊíÊÇäíæã 256 ÌíÌÇ",
            description: "ÂíÝæä 15 ÈÑæ ãÇßÓ¡ ÓÚÉ 256 ÌíÌÇÈÇíÊ¡ Çááæä ÊíÊÇäíæã ØÈíÚí¡ ãÓÊÎÏã äÙíÝ ÌÏÇð ßÑÊ ÎÇáí ãä ÇáÎÏæÔ¡ ãÚ ßÇãá ãáÍÞÇÊå ÇáÃÕáíÉ æÇáßÑÊæä¡ äÓÈÉ ÕÍÉ ÇáÈØÇÑíÉ 96%. ÛíÑ ãÝÊæÍ æÛíÑ ãÝßæß ÅØáÇÞÇð æÚáì ÇáÖãÇä ÇáÝäí.",
            price: 1100,
            currency: "USD",
            city: "sanaa_city",
            district: "sanaa_hadda",
            categoryId: getDeterministicUuid("phones"),
            images: {
              create: [
                "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=400&q=80"
              ].map((url, i) => ({ url, sortOrder: i }))
            },
            status: "ACTIVE" as const,
            userId: getDeterministicUuid("user_3")
          },
          {
            id: getDeterministicUuid("ad_4"),
            title: "ßãÈíæÊÑ ÃáÚÇÈ æÍÔ ÇáÝÆÉ ÇáÇÍÊÑÇÝíÉ RTX 4500 RYZEN 9",
            description: "ááÈíÚ ßãÈíæÊÑ ÃáÚÇÈ æÊÕãíã ÇÍÊÑÇÝí ÎÇÑÞ¡ ÇáãÚÇáÌ: AMD Ryzen 9 5900X¡ ßÑÊ ÇáÔÇÔÉ: Nvidia RTX 4070 Ti 12GB¡ ÇáÐÇßÑÉ ÇáÚÔæÇÆíÉ: 32GB RGB DDR4¡ ÓÚÉ ÇáÊÎÒíä: 1TB NVMe SSD ÝÇÆÞÉ ÇáÓÑÚÉ¡ ÊÈÑíÏ ãÇÆí ãÛáÞ åÇÏÆ¡ ØÇÞÉ 750W ÐåÈí.",
            price: 1850,
            currency: "USD",
            city: "hadramout",
            district: "had_mukalla",
            categoryId: getDeterministicUuid("laptops"),
            images: {
              create: [
                "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=400&q=80"
              ].map((url, i) => ({ url, sortOrder: i }))
            },
            status: "ACTIVE" as const,
            userId: getDeterministicUuid("user_3")
          }
        ];

        for (const ad of initialAds) {
          await this.ad.upsert({
            where: { id: ad.id },
            update: {},
            create: ad
          });
        }
        console.log("Initial ads seeded successfully.");
      }
    } catch (e) {
      console.error("Error seeding database", e);
    }
  }
}
