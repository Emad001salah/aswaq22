import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { App } from '../server/app.ts';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'aswaq_jwt_secret_dev_key_2026_super_secure_998231';

async function main() {
  // Start server on a random/dev port
  process.env.PORT = '3099';
  const server = new App();
  await server.start();
  
  try {
    const user = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });
    
    if (!user) {
      console.log('No user found');
      return;
    }
    
    // Generate valid JWT token
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log('Token:', token);
    
    // Test 1: Fetch /api/v1/users/me
    console.log('Testing GET /api/v1/users/me...');
    const getRes = await fetch('http://localhost:3099/api/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('GET Response:', getRes.status, await getRes.text());
    
    // Test 2: Patch /api/v1/users/me
    console.log('Testing PATCH /api/v1/users/me...');
    const patchRes = await fetch('http://localhost:3099/api/v1/users/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: user.name + ' E2E Test',
        bio: 'Updated bio via test script'
      })
    });
    console.log('PATCH Response:', patchRes.status, await patchRes.text());
    
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await server.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
