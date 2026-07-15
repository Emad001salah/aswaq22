import { Controller, Get, Post, Put, Delete, Body, Query, Param, Patch } from '@nestjs/common';
import { AdsService } from './ads.service';

@Controller('api/ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('subCategory') subCategory?: string,
    @Query('city') city?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.adsService.findAll({ category, subCategory, city, q, cursor, limit: parsedLimit });
  }

  @Get('search')
  searchAll(@Query('q') q: string) {
    return this.adsService.findAll({ q });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adsService.findOne(id);
  }

  @Post()
  create(@Body() adData: any) {
    return this.adsService.create(adData);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.adsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adsService.remove(id);
  }

  @Patch(':id/moderate')
  moderate(@Param('id') id: string, @Body() body: { status: string; isFeatured?: boolean }) {
    return this.adsService.moderate(id, body.status, body.isFeatured);
  }
}
