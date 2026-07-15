import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emails = ['emad001salah@gmail.com', 'eee3327@gmail.com'];

  console.log('--- Database Admin Role Update ---');

  for (const email of emails) {
    // Find if the user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      console.log(`Found user: ${user.name} (${user.email}), current role: ${user.role}`);
      
      // Update role to ADMIN
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.SUPER_ADMIN }, // Set to SUPER_ADMIN to ensure maximum privileges
      });

      console.log(`Updated user ${updated.email} to role: ${updated.role}`);
    } else {
      console.log(`User with email ${email} not found. Creating a new ADMIN user...`);
      // Create user if not exists (with dummy password hash)
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('AdminPassword123!', salt);

      const newUser = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0],
          password: passwordHash,
          role: UserRole.SUPER_ADMIN,
          isVerified: 'verified',
        }
      });
      console.log(`Created new SUPER_ADMIN user: ${newUser.name} (${newUser.email})`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error running admin update:', e);
});
