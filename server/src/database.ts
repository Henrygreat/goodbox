import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function initializeDatabase(): Promise<void> {
  // Create default super admin if not exists
  const adminExists = await prisma.user.findFirst({
    where: { role: 'super_admin' }
  });

  if (!adminExists) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    await prisma.user.create({
      data: {
        email: 'admin@church.com',
        passwordHash,
        name: 'Super Admin',
        role: 'super_admin'
      }
    });
    console.log('Default admin created: admin@church.com / admin123');
  }
}

export default prisma;
