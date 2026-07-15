import { prisma } from './src/lib/prisma.ts';
import { authService } from './server/services/auth.service.ts';

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'debug@test.com' } });
  if (!user) {
    console.log('No user found, creating...');
    const created = await prisma.user.create({
      data: {
        email: 'debug@test.com',
        name: 'Debug',
        password: 'test',
        role: 'USER'
      }
    });
    const tokens = await authService.generateTokens(created.id, created.email, created.role);
    console.log('Generated refresh token:', tokens.refreshToken);
    
    try {
      const refreshed = await authService.refresh(tokens.refreshToken);
      console.log('Refresh succeeded');
    } catch (e: any) {
      console.log('Refresh failed:', e.message);
    }
    
    await prisma.refreshToken.deleteMany({ where: { userId: created.id } });
    await prisma.user.delete({ where: { id: created.id } });
  } else {
    const tokens = await authService.generateTokens(user.id, user.email, user.role);
    console.log('Generated refresh token:', tokens.refreshToken);
    
    try {
      const refreshed = await authService.refresh(tokens.refreshToken);
      console.log('Refresh succeeded');
    } catch (e: any) {
      console.log('Refresh failed:', e.message);
    }
    
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  }
  
  await prisma.$disconnect();
}

main();
