import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const puzzleId = searchParams.get("puzzleId");

    if (!puzzleId) {
      return NextResponse.json(
        { error: "puzzleId is required" },
        { status: 400 }
      );
    }

    // Get all ratings for this puzzle
    const ratings = await prisma.puzzleRating.findMany({
      where: { puzzleId },
      select: { rating: true },
    });

    if (ratings.length === 0) {
      return NextResponse.json({
        puzzleId,
        averageRating: 0,
        ratingCount: 0,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      });
    }

    // Calculate average
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / ratings.length;

    // Calculate distribution
    const distribution = {
      1: ratings.filter(r => r.rating === 1).length,
      2: ratings.filter(r => r.rating === 2).length,
      3: ratings.filter(r => r.rating === 3).length,
      4: ratings.filter(r => r.rating === 4).length,
      5: ratings.filter(r => r.rating === 5).length,
    };

    return NextResponse.json({
      puzzleId,
      averageRating: Math.round(average * 100) / 100, // Round to 2 decimals
      ratingCount: ratings.length,
      ratingDistribution: distribution,
    });
  } catch (error) {
    console.error("Error fetching puzzle rating stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch rating stats" },
      { status: 500 }
    );
  }
}
