#!/usr/bin/env node

import path from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Load env files
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'dev@local.test';
  const password = process.argv[3] || 'password123';
  const name = process.argv[4] || 'Dev Tester';

  const hash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { password: hash, name },
      create: {
        email,
        name,
        password: hash,
        role: 'PLAYER',
      },
    });

    console.log(`✅ Dev user ready: ${email} (id=${user.id})`);
  } catch (e) {
    console.error('❌ Error creating dev user:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
