import { Controller, Get, Query, Patch, Body } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats(@Query('market') market?: string) {
    return this.adminService.getStats(market);
  }

  @Patch('settings')
  async updateSettings(@Body() data: { commission: number; featuredPrice: number }) {
    return this.adminService.updateSettings(data);
  }
}
