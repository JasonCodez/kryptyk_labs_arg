import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = await prisma.puzzleCategory.findMany({
      include: {
        _count: {
          select: {
            puzzles: {
              where: {
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const categoriesWithCount = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      color: cat.color,
      icon: cat.icon,
      puzzleCount: cat._count.puzzles,
    }));

    return NextResponse.json(categoriesWithCount);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
