#!/usr/bin/env node

import path from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error('Usage: npx tsx scripts/set-password.ts <email> <password>');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({ where: { email }, data: { password: hash } });
    console.log(`✅ Updated password for ${email} (id=${user.id})`);
  } catch (e) {
    console.error('❌ Error setting password:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
