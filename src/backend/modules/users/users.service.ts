import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async login(email: string) {
    // Basic mock user until DB is fully seeded for preview purposes
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // For seamless preview experience without breaking signup flow
      user = await this.prisma.user.create({
        data: {
          email,
          name: email.split('@')[0],
          password: 'default-password-preview',
          role: 'USER',
          avatar: null,
        }
      });
    }
    return user;
  }

  async register(data: { name: string; email: string; phone?: string; avatar?: string }) {
    let user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (user) {
      return user; 
    }
    user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone || null,
        password: 'default-password-preview',
        avatar: data.avatar || null,
        role: 'USER'
      }
    });
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateVerify(id: string, verified: boolean) {
    // This is mocked as user table doesn't have verified field in prisma schema
    return { id, verified };
  }

  async updateStatus(id: string, active: boolean) {
    // This is mocked as user table doesn't have active field in prisma schema
    return { id, active };
  }

  async getFavorites(id: string) {
    const likes = await this.prisma.adLike.findMany({
      where: { userId: id },
      select: { adId: true }
    });
    return likes.map(l => l.adId);
  }

  async toggleFavorite(id: string, adId: string, action: 'add' | 'remove') {
    if (action === 'add') {
      await this.prisma.adLike.upsert({
        where: { adId_userId: { userId: id, adId } },
        create: { userId: id, adId },
        update: {}
      });
    } else {
      await this.prisma.adLike.deleteMany({
        where: { userId: id, adId }
      });
    }
    return { success: true };
  }
}
