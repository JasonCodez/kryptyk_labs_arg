#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function promoteToAdmin(email: string) {
  try {
    if (!email) {
      console.error("❌ Email is required. Usage: npx tsx scripts/make-admin.ts <email>");
      process.exit(1);
    }

    console.log(`🔄 Looking for user with email: ${email}`);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      process.exit(1);
    }

    if (user.role === "admin") {
      console.log(`✅ User "${email}" is already an admin`);
      process.exit(0);
    }

    const updated = await prisma.user.update({
      where: { email },
      data: { role: "admin" },
    });

    console.log(`✅ Successfully promoted "${email}" to admin`);
    console.log(`   ID: ${updated.id}`);
    console.log(`   Role: ${updated.role}`);
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
promoteToAdmin(email);
