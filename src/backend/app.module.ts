import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AdsController } from './modules/ads/ads.controller';
import { AdsService } from './modules/ads/ads.service';
import { ChatGateway } from './modules/chat/chat.gateway';
import { StorageController } from './modules/storage/storage.controller';
import { StorageService } from './modules/storage/storage.service';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { ChatController } from './modules/chat/chat.controller';
import { MockController } from './modules/mock.controller';
import { AdminController } from './modules/admin/admin.controller';
import { AdminService } from './modules/admin/admin.service';

import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisService } from './redis.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [AdsController, StorageController, UsersController, ChatController, MockController, AdminController],
  providers: [PrismaService, RedisService, AdsService, ChatGateway, StorageService, UsersService, AdminService],
})
export class AppModule {}
