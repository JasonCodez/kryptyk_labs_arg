#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'admin@local';
  const name = process.argv[3] || 'Admin User';

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`User already exists: ${email} (id=${existing.id})`);
      if (existing.role !== 'admin') {
        await prisma.user.update({ where: { email }, data: { role: 'admin' } });
        console.log('Promoted existing user to admin');
      }
      return;
    }

    const created = await prisma.user.create({
      data: {
        email,
        name,
        role: 'admin',
      },
    });

    console.log('Created admin user:', created);
  } catch (e) {
    console.error('Error creating admin user:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
