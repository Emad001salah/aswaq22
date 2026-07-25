import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ log: ['error'] });
const r = await p.ad.updateMany({ where: { status: 'PENDING' }, data: { status: 'ACTIVE' } });
console.log('Activated', r.count, 'pending ads to ACTIVE');
await p.$disconnect();
