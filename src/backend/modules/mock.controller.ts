import { Controller, Get, Body, Post, Param } from '@nestjs/common';

@Controller('api')
export class MockController {
  @Get('notifications')
  getNotifications() { return []; }

  @Post('notifications/read')
  readNotifications() { return { success: true }; }

  @Get('reviews')
  getReviews() { return []; }

  @Post('reviews')
  postReview() { return { success: true }; }

  @Post('ai/enhance-ad')
  enhanceAd(@Body() body: any) { 
    return { enhancedText: body.description + ' تم صياغته باحترافية' }; 
  }

  @Post('ai/negotiate')
  negotiate() { return { responseText: 'تم الرد من المساعد الذكي' }; }

  @Post('ai/search-assistant')
  searchAi() { return { message: 'نتائج البحث الذكية', contextAds: [] }; }

  @Post('ai/trust-check')
  trustCheck() {
    return {
      score: 85,
      risks: ['لا يوجد مخاطر وملف المستخدم موثق'],
      advice: 'هذا الإعلان يبدو موثوقاً وسعر السلعة مناسب'
    };
  }

  @Post('ai/price-insights')
  priceInsights() {
    return {
      status: 'fair',
      marketAverage: '1000',
      advice: 'السعر متوافق مع متوسط أسعار أسواقنا لهذا النوع من المنتجات'
    };
  }
}
