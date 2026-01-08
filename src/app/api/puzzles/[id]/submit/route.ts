import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
	try {
		// Unwrap params if it's a Promise (Next.js app router sometimes passes a Promise)
		let puzzleId: string;
		if (context.params instanceof Promise) {
			const resolved = await context.params;
			puzzleId = resolved.id;
		} else {
			puzzleId = context.params.id;
		}

		const body = await request.json();
		const { answer } = body;

		if (!answer || typeof answer !== "string") {
			return NextResponse.json({ error: "No answer provided" }, { status: 400 });
		}

		const puzzle = await prisma.puzzle.findUnique({
			where: { id: puzzleId },
			select: { riddleAnswer: true },
		});

		if (!puzzle) {
			return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
		}
		if (!puzzle.riddleAnswer) {
			return NextResponse.json({ error: "No riddle answer set for this puzzle" }, { status: 400 });
		}

		const isCorrect = puzzle.riddleAnswer.trim().toLowerCase() === answer.trim().toLowerCase();
		return NextResponse.json({ correct: isCorrect });
	} catch (err) {
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
