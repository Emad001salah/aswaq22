import { Controller, Post, Body, HttpException, HttpStatus, Get, Patch, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  async login(@Body() body: { email: string }) {
    if (!body.email) {
      throw new HttpException('Email is required', HttpStatus.BAD_REQUEST);
    }
    const user = await this.usersService.login(body.email);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
    }
    return { user };
  }

  @Post('register')
  async register(@Body() body: { name: string; email: string; phone?: string; avatar?: string }) {
    // Basic required fields
    if (!body.email || !body.name) {
      throw new HttpException('Name and email are required', HttpStatus.BAD_REQUEST);
    }
    // Validate phone format if provided (E.164)
    if (body.phone) {
      const e164Regex = /^\+[1-9]\d{1,14}$/;
      if (!e164Regex.test(body.phone)) {
        throw new HttpException('Phone number must be in E.164 format (e.g., +123456789)', HttpStatus.BAD_REQUEST);
      }
    }
    // Enforce avatar URLs to be from internal uploads only
    if (body.avatar) {
      const allowedPrefix = '/api/uploads/';
      if (!body.avatar.startsWith(allowedPrefix)) {
        throw new HttpException('External avatar URLs are not allowed', HttpStatus.BAD_REQUEST);
      }
    }
    const user = await this.usersService.register(body);
    return { user };
  }

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id/verify')
  async updateVerify(@Param('id') id: string, @Body() body: { verified: boolean }) {
    return this.usersService.updateVerify(id, body.verified);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { active: boolean }) {
    return this.usersService.updateStatus(id, body.active);
  }

  @Get(':id/favorites')
  async getFavorites(@Param('id') id: string) {
    return this.usersService.getFavorites(id);
  }

  @Post(':id/favorites')
  async toggleFavorite(@Param('id') id: string, @Body() body: { adId: string, action: 'add' | 'remove' }) {
    return this.usersService.toggleFavorite(id, body.adId, body.action);
  }
}
