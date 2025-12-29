require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: ["error"],
});

async function promoteToAdmin(email) {
  try {
    if (!email) {
      console.error(
        "❌ Email is required.\n\nUsage: node scripts/make-admin.js <email>"
      );
      process.exit(1);
    }

    console.log(`🔄 Looking for user with email: ${email}`);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      console.log("\n📋 Available users:");
      const allUsers = await prisma.user.findMany({
        select: { email: true, role: true },
      });
      allUsers.forEach((u) => {
        console.log(`   • ${u.email} (${u.role})`);
      });
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

    console.log(`\n✅ Successfully promoted "${email}" to admin!`);
    console.log(`   ID: ${updated.id}`);
    console.log(`   Role: ${updated.role}`);
    console.log(`\nYou can now access /admin/puzzles`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.message.includes("fetch failed")) {
      console.error(
        "\n⚠️  Database connection failed. Make sure:"
      );
      console.error("   1. PostgreSQL is running on localhost:5432");
      console.error("   2. Database credentials in .env.local are correct");
      console.error("   3. The 'kryptyk_labs_arg' database exists");
      console.error("\nDATABASE_URL from .env.local:");
      console.error("  " + process.env.DATABASE_URL);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];

// If no email provided, show available users first
if (!email) {
  (async () => {
    try {
      console.log("❌ Email is required.\n\nUsage: node scripts/make-admin.js <email>\n");
      console.log("📋 Available users:");
      const allUsers = await prisma.user.findMany({
        select: { email: true, role: true },
      });
      if (allUsers.length === 0) {
        console.log("   (no users found)");
      } else {
        allUsers.forEach((u) => {
          console.log(`   • ${u.email} (${u.role})`);
        });
      }
    } finally {
      await prisma.$disconnect();
      process.exit(1);
    }
  })();
} else {
  promoteToAdmin(email);
}
