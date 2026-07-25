import { prisma } from './src/lib/prisma.ts';

async function main() {
  const cats = await prisma.category.findMany({
    include: { _count: { select: { ads: true } } }
  });
  
  console.log('\n=== CATEGORIES IN DATABASE ===');
  cats.forEach(c => {
    console.log(`  [${c.id.substring(0,8)}] nameAr="${c.nameAr}" nameEn="${c.nameEn}" icon="${c.icon}" ads=${c._count.ads}`);
  });
  console.log(`\nTotal categories: ${cats.length}`);
  
  const ads = await prisma.ad.findMany({
    select: { id: true, title: true, categoryId: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  console.log('\n=== RECENT ADS ===');
  ads.forEach(a => {
    const cat = cats.find(c => c.id === a.categoryId);
    console.log(`  [${a.id.substring(0,8)}] "${a.title.substring(0,30)}" -> category="${cat?.nameAr || 'NOT FOUND'}" status=${a.status}`);
  });
  
  await prisma['$disconnect']();
}

main().catch(e => { console.error(e); process.exit(1); });
