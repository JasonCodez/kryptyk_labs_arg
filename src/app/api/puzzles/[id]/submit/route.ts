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
			select: { riddleAnswer: true, puzzleType: true, data: true, sudoku: { select: { id: true } } },
		});

		if (!puzzle) {
			return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
		}

		// If puzzle has no riddle answer but is a Sudoku, treat the special 'SUDOKU_SOLVED' token as correct
		if (!puzzle.riddleAnswer) {
			if (puzzle.puzzleType === 'sudoku' && answer.trim() === 'SUDOKU_SOLVED') {
				return NextResponse.json({ correct: true });
			}
			if (puzzle.puzzleType === 'code_master') {
				const data = (puzzle.data || {}) as Record<string, unknown>;
				const validationMode = (data.validationMode as string) || 'exact';
				const expectedFix = (data.expectedFix as string) || '';
				const rules = (data.validationRules as Record<string, unknown>) || {};
				const mustContain = Array.isArray(rules.mustContain) ? (rules.mustContain as string[]) : [];
				const mustNotContain = Array.isArray(rules.mustNotContain) ? (rules.mustNotContain as string[]) : [];
				const regex = typeof rules.regex === 'string' ? rules.regex : '';
				const ignoreCase = Boolean(rules.ignoreCase);
				const ignoreWhitespace = Boolean(rules.ignoreWhitespace);
				const colorFlex = (rules as { colorFlex?: boolean }).colorFlex !== false;

				const mapColorName = (r: number, g: number, b: number) => {
					if (r < 30 && g < 30 && b < 30) return 'black';
					if (r > 225 && g > 225 && b > 225) return 'white';
					if (b > r + 30 && b > g + 30) return 'blue';
					if (r > g + 30 && r > b + 30) return 'red';
					if (g > r + 30 && g > b + 30) return 'green';
					return null;
				};

				const normalizeColors = (value: string) => {
					let out = value;
					out = out.replace(/#([0-9a-f]{3}|[0-9a-f]{6})/gi, (match, hex) => {
						let h = String(hex);
						if (h.length === 3) h = h.split('').map((c) => c + c).join('');
						const r = parseInt(h.slice(0, 2), 16);
						const g = parseInt(h.slice(2, 4), 16);
						const b = parseInt(h.slice(4, 6), 16);
						const name = mapColorName(r, g, b);
						return name ? ` ${name} ` : match;
					});
					out = out.replace(/rgba?\(([^)]+)\)/gi, (match, inner) => {
						const parts = String(inner)
							.split(',')
							.map((v) => v.trim())
							.slice(0, 3);
						const r = Number(parts[0]);
						const g = Number(parts[1]);
						const b = Number(parts[2]);
						if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return match;
						const name = mapColorName(r, g, b);
						return name ? ` ${name} ` : match;
					});
					return out;
				};

				const normalize = (value: string) => {
					let next = value ?? '';
					if (colorFlex) next = normalizeColors(next);
					if (ignoreWhitespace) next = next.replace(/\s+/g, '');
					next = next.trim();
					return ignoreCase ? next.toLowerCase() : next;
				};

				const normalizedAnswer = normalize(answer);
				const normalizedExpected = normalize(expectedFix);

				if (validationMode === 'regex') {
					if (!regex) {
						return NextResponse.json({ correct: false, message: 'No regex configured for this puzzle.' });
					}
					try {
						const re = new RegExp(regex, ignoreCase ? 'i' : undefined);
						return NextResponse.json({ correct: re.test(normalizedAnswer) });
					} catch (e) {
						return NextResponse.json({ correct: false, message: 'Invalid regex configuration.' });
					}
				}

				if (validationMode === 'contains') {
					const okContains = mustContain.length === 0
						? (normalizedExpected ? normalizedAnswer.includes(normalizedExpected) : true)
						: mustContain.every((chunk) => normalize(String(chunk)) && normalizedAnswer.includes(normalize(String(chunk))));
					const okNotContains = mustNotContain.every((chunk) => !normalize(String(chunk)) || !normalizedAnswer.includes(normalize(String(chunk))));
					return NextResponse.json({ correct: okContains && okNotContains });
				}

				// exact
				if (!normalizedExpected) {
					return NextResponse.json({ correct: false, message: 'No expected fix configured for this puzzle.' });
				}
				return NextResponse.json({ correct: normalizedAnswer === normalizedExpected });
			}
			return NextResponse.json({ error: "No riddle answer set for this puzzle" }, { status: 400 });
		}

		const isCorrect = puzzle.riddleAnswer.trim().toLowerCase() === answer.trim().toLowerCase();
		return NextResponse.json({ correct: isCorrect });
	} catch (err) {
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
