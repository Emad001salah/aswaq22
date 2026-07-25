/**
 * Aswaq22 - Database Categories Seed & Fix Script
 */

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

function getDeterministicUuid(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) return str.toLowerCase();
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  const part1 = hash.substring(0, 8);
  const part2 = hash.substring(8, 12);
  const part3 = '4' + hash.substring(13, 16);
  const part4 = 'a' + hash.substring(17, 20);
  const part5 = hash.substring(20, 32);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

const CANONICAL_CATEGORIES = [
  { id: 'jobs',               nameAr: 'بوابة الوظائف والفرص',            nameEn: 'Jobs & Opportunities',         icon: 'Briefcase' },
  { id: 'cars',               nameAr: 'سيارات ومركبات',                   nameEn: 'Vehicles',                      icon: 'Car' },
  { id: 'realestate',         nameAr: 'عقارات وأراضي',                    nameEn: 'Real Estate',                   icon: 'Building2' },
  { id: 'rent_housing',       nameAr: 'سكن للإيجار',                      nameEn: 'Rental Housing',                icon: 'Home' },
  { id: 'hotels',             nameAr: 'فنادق',                            nameEn: 'Hotels',                        icon: 'Building' },
  { id: 'resorts',            nameAr: 'منتجعات وأماكن ترفيهية',           nameEn: 'Resorts & Recreation',          icon: 'Palmtree' },
  { id: 'car_rental',         nameAr: 'تأجير سيارات',                     nameEn: 'Car Rental',                    icon: 'Key' },
  { id: 'electronics',        nameAr: 'إلكترونيات وأجهزة منزلية',         nameEn: 'Electronics & Appliances',      icon: 'Tv' },
  { id: 'furniture',          nameAr: 'أثاث ومستلزمات منزلية',            nameEn: 'Furniture & Home',              icon: 'Armchair' },
  { id: 'other',              nameAr: 'أخرى',                             nameEn: 'Other',                         icon: 'Edit' },
  { id: 'handicrafts',        nameAr: 'أشغال يدوية وحرفية',               nameEn: 'Handicrafts & Arts',            icon: 'Palette' },
  { id: 'food',               nameAr: 'أغذية ومأكولات منزلية',            nameEn: 'Food & Groceries',              icon: 'Utensils' },
  { id: 'services',           nameAr: 'خدمات صيانة ومعاملات وشحن',        nameEn: 'Maintenance & Services',        icon: 'Wrench' },
  { id: 'bicycles',           nameAr: 'دراجات هوائية ونارية',             nameEn: 'Bicycles & Bikes',              icon: 'Bike' },
  { id: 'heavy_equipment',    nameAr: 'شاحنات ومعدات ثقيلة وآلات',        nameEn: 'Heavy Duty & Trucks',           icon: 'Truck' },
  { id: 'perfumes',           nameAr: 'عطور ومستحضرات تجميل',             nameEn: 'Perfumes & Beauty',             icon: 'Sparkles' },
  { id: 'books',              nameAr: 'كتب وتدريب ومستلزمات',             nameEn: 'Books & Training',              icon: 'BookOpen' },
  { id: 'laptops',            nameAr: 'كمبيوتر ومستلزمات شبكات',          nameEn: 'Computers & IT',               icon: 'Laptop' },
  { id: 'medical',            nameAr: 'مستلزمات طبية وصحة وجمال',         nameEn: 'Medical & Health',              icon: 'Stethoscope' },
  { id: 'fashion',            nameAr: 'ملابس وموضة وأزياء',               nameEn: 'Fashion & Clothes',             icon: 'Shirt' },
  { id: 'building_materials', nameAr: 'مواد بناء ومقاولات وديكور',         nameEn: 'Building Materials',            icon: 'Hammer' },
  { id: 'livestock',          nameAr: 'مواشي وحيوانات وعلاجات',           nameEn: 'Animals & Livestock',           icon: 'PawPrint' },
  { id: 'phones',             nameAr: 'هواتف ذكية واكسسوارات',            nameEn: 'Smartphones & Accessories',     icon: 'Smartphone' },
];

const SUBCATEGORIES = {
  cars:               [{ id: 'sedan', nameAr: 'سيدان', nameEn: 'Sedan' }, { id: 'suv', nameAr: 'دفع رباعي (SUV)', nameEn: 'SUV' }, { id: 'pickup', nameAr: 'بيك آب / باص', nameEn: 'Pickup / Bus' }, { id: 'truck', nameAr: 'شاحنات', nameEn: 'Trucks' }, { id: 'motorcycle', nameAr: 'دراجات نارية', nameEn: 'Motorcycles' }, { id: 'car_parts', nameAr: 'قطع غيار', nameEn: 'Spare Parts' }],
  realestate:         [{ id: 'apartment', nameAr: 'شقق', nameEn: 'Apartments' }, { id: 'villa', nameAr: 'فلل', nameEn: 'Villas' }, { id: 'land', nameAr: 'أراضي', nameEn: 'Land' }, { id: 'building', nameAr: 'عمائر', nameEn: 'Buildings' }, { id: 'commercial', nameAr: 'محلات', nameEn: 'Commercial' }],
  resorts:            [{ id: 'chalet', nameAr: 'شاليه', nameEn: 'Chalet' }, { id: 'resort', nameAr: 'منتجع', nameEn: 'Resort' }, { id: 'farm', nameAr: 'مزرعة', nameEn: 'Farm' }, { id: 'camp', nameAr: 'مخيم', nameEn: 'Camp' }],
  phones:             [{ id: 'smartphone', nameAr: 'هواتف ذكية', nameEn: 'Smartphones' }, { id: 'tablet', nameAr: 'تابلت', nameEn: 'Tablets' }, { id: 'smartwatch', nameAr: 'ساعات ذكية', nameEn: 'Smart Watches' }, { id: 'accessories', nameAr: 'إكسسوارات', nameEn: 'Accessories' }],
  electronics:        [{ id: 'tv', nameAr: 'شاشات', nameEn: 'TVs' }, { id: 'home_appliances', nameAr: 'أجهزة منزلية', nameEn: 'Home Appliances' }, { id: 'audio', nameAr: 'سماعات', nameEn: 'Audio' }, { id: 'cameras', nameAr: 'كاميرات', nameEn: 'Cameras' }],
  furniture:          [{ id: 'living_room', nameAr: 'مجالس', nameEn: 'Living Room' }, { id: 'bedroom', nameAr: 'غرف نوم', nameEn: 'Bedrooms' }, { id: 'kitchen', nameAr: 'مطبخ', nameEn: 'Kitchen' }, { id: 'decor', nameAr: 'ديكورات', nameEn: 'Decor' }, { id: 'office', nameAr: 'أثاث مكتبي', nameEn: 'Office Furniture' }],
  jobs:               [{ id: 'admin', nameAr: 'إدارة ومبيعات', nameEn: 'Management & Sales' }, { id: 'tech', nameAr: 'برمجة وتقنية', nameEn: 'IT & Software' }, { id: 'medical_job', nameAr: 'طب وصيدلة', nameEn: 'Medical' }, { id: 'driver_job', nameAr: 'سائقين', nameEn: 'Drivers' }],
  services:           [{ id: 'maintenance', nameAr: 'صيانة منزلية', nameEn: 'Home Maintenance' }, { id: 'car_repair', nameAr: 'صيانة سيارات', nameEn: 'Car Repair' }, { id: 'transport', nameAr: 'نقل عفش', nameEn: 'Moving & Shipping' }],
  car_rental:         [{ id: 'daily', nameAr: 'تأجير يومي', nameEn: 'Daily Rental' }, { id: 'monthly', nameAr: 'تأجير شهري', nameEn: 'Monthly Rental' }, { id: 'with_driver', nameAr: 'مع سائق', nameEn: 'With Driver' }],
  food:               [{ id: 'honey', nameAr: 'عسل', nameEn: 'Honey' }, { id: 'coffee', nameAr: 'بن وقهوة', nameEn: 'Coffee' }, { id: 'dates', nameAr: 'تمور', nameEn: 'Dates' }],
  heavy_equipment:    [{ id: 'excavators', nameAr: 'حفارات', nameEn: 'Excavators' }, { id: 'loaders', nameAr: 'رافعات', nameEn: 'Loaders' }],
  livestock:          [{ id: 'sheep', nameAr: 'أغنام', nameEn: 'Sheep' }, { id: 'birds', nameAr: 'طيور', nameEn: 'Birds' }, { id: 'horses', nameAr: 'خيول', nameEn: 'Horses' }, { id: 'cats_dogs', nameAr: 'حيوانات أليفة', nameEn: 'Pets' }],
  building_materials: [{ id: 'iron_cement', nameAr: 'حديد وإسمنت', nameEn: 'Steel & Cement' }, { id: 'tiles_marble', nameAr: 'بلاط ورخام', nameEn: 'Tiles & Marble' }],
};

async function main() {
  console.log('\n🔧 Aswaq22 - Categories DB Fix & Seed Script');
  console.log('='.repeat(60));

  const existingCats = await prisma.category.findMany();
  console.log(`\n📊 Current state: ${existingCats.length} categories in DB`);
  existingCats.forEach(c => {
    console.log(`   [${c.id.substring(0,8)}] "${c.nameAr}" / "${c.nameEn}"`);
  });

  const canonicalUuids = new Set(CANONICAL_CATEGORIES.map(c => getDeterministicUuid(c.id)));
  const badCats = existingCats.filter(c => !canonicalUuids.has(c.id));
  
  console.log(`\n⚠️  Non-canonical categories: ${badCats.length}`);

  // Upsert all canonical categories
  console.log(`\n📝 Upserting ${CANONICAL_CATEGORIES.length} canonical categories...`);
  for (const cat of CANONICAL_CATEGORIES) {
    const uuid = getDeterministicUuid(cat.id);
    await prisma.category.upsert({
      where: { id: uuid },
      create: { id: uuid, nameAr: cat.nameAr, nameEn: cat.nameEn, icon: cat.icon },
      update: { nameAr: cat.nameAr, nameEn: cat.nameEn, icon: cat.icon }
    });
    console.log(`   ✅ [${uuid.substring(0,8)}] "${cat.nameAr}"`);
  }

  // Fix ads linked to bad categories
  for (const badCat of badCats) {
    const adsWithBadCat = await prisma.ad.findMany({ where: { categoryId: badCat.id } });
    console.log(`\n🔄 Bad category "${badCat.nameAr}" (${badCat.nameEn}) has ${adsWithBadCat.length} ads`);

    if (adsWithBadCat.length > 0) {
      // Try to find matching canonical category
      const nameToMatch = (badCat.nameEn || badCat.nameAr || '').toLowerCase().trim();
      let targetCatSlug = 'other';
      
      for (const cat of CANONICAL_CATEGORIES) {
        if (nameToMatch === cat.id.toLowerCase() || 
            nameToMatch === cat.nameEn.toLowerCase() ||
            cat.id.toLowerCase().includes(nameToMatch) ||
            nameToMatch.includes(cat.id.toLowerCase())) {
          targetCatSlug = cat.id;
          break;
        }
      }
      
      const targetUuid = getDeterministicUuid(targetCatSlug);
      console.log(`   → Migrating to "${targetCatSlug}" [${targetUuid.substring(0,8)}]`);
      
      await prisma.ad.updateMany({
        where: { categoryId: badCat.id },
        data: { categoryId: targetUuid }
      });
    }

    // Delete bad category (subCategories will cascade)
    try {
      await prisma.subCategory.deleteMany({ where: { categoryId: badCat.id } });
      await prisma.category.delete({ where: { id: badCat.id } });
      console.log(`   🗑️  Deleted orphan category`);
    } catch(e) {
      console.log(`   ⚠️  Could not delete: ${e.message}`);
    }
  }

  // Seed subcategories
  console.log('\n📂 Seeding subcategories...');
  for (const [catSlug, subs] of Object.entries(SUBCATEGORIES)) {
    const catUuid = getDeterministicUuid(catSlug);
    for (const sub of subs) {
      const subUuid = getDeterministicUuid(sub.id);
      await prisma.subCategory.upsert({
        where: { id: subUuid },
        create: { id: subUuid, categoryId: catUuid, nameAr: sub.nameAr, nameEn: sub.nameEn },
        update: { nameAr: sub.nameAr, nameEn: sub.nameEn, categoryId: catUuid }
      });
    }
    console.log(`   ✅ ${subs.length} subs for "${catSlug}"`);
  }

  // Final verification
  console.log('\n✅ Final Database State:');
  const finalCats = await prisma.category.findMany({
    include: { _count: { select: { ads: true } } },
  });
  finalCats.forEach(c => {
    console.log(`   [${c.id.substring(0,8)}] "${c.nameAr}" (${c._count.ads} ads)`);
  });
  console.log(`\n   Total categories: ${finalCats.length}`);
  
  const totalAds = await prisma.ad.count();
  console.log(`   Total ads: ${totalAds}`);
  console.log('\n🎉 Done! All categories seeded successfully.');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
