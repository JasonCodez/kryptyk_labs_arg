import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import {
  buildFrequencyCanonicalConfig,
  calculateFrequencyScore,
  isWithinFrequencyWordLimit,
  MAX_FREQUENCY_ANSWER_WORDS,
  MAX_FREQUENCY_ANSWERS,
} from "@/lib/frequency";
import { rebuildFrequencyAnswerGroups } from "@/lib/frequency-service";

// POST /api/frequency/submit
// Body: { questionId, answers: string[], sessionId?: string }
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id ?? null;

  const body = await request.json();
  const { questionId, answers, sessionId } = body as {
    questionId: string;
    answers: string[];
    sessionId?: string;
  };

  if (!questionId || !Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  // Max 3 answers, non-empty strings only
  const rawAnswers: string[] = answers
    .filter((a) => typeof a === "string" && a.trim().length > 0)
    .slice(0, MAX_FREQUENCY_ANSWERS);

  if (rawAnswers.length === 0) {
    return NextResponse.json({ error: "No valid answers" }, { status: 400 });
  }

  const tooLong = rawAnswers.find((a) => !isWithinFrequencyWordLimit(a));
  if (tooLong) {
    return NextResponse.json(
      { error: `Answers can be at most ${MAX_FREQUENCY_ANSWER_WORDS} words: "${tooLong}"` },
      { status: 400 }
    );
  }

  const question = await prisma.frequencyQuestion.findUnique({
    where: { id: questionId },
    select: { id: true, status: true, canonicalGroups: true },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // Prevent duplicate submissions
  if (userId) {
    const existing = await prisma.frequencySubmission.findUnique({
      where: { questionId_userId: { questionId, userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }
  } else if (sessionId) {
    // Guest duplicate check via session cookie
    const guestExisting = await prisma.frequencySubmission.findFirst({
      where: { questionId, sessionId },
    });
    if (guestExisting) {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }
  }

  // Create the submission (score = 0 until revealed/recalculated)
  // For guests, ensure we have a session ID (generate one if the client didn't send one)
  const effectiveSessionId = userId ? null : (sessionId || randomUUID());
  const submission = await prisma.frequencySubmission.create({
    data: {
      questionId,
      userId: userId ?? null,
      sessionId: effectiveSessionId,
      answers: rawAnswers,
      score: 0,
    },
  });

  const { answers: allAnswers, totalSubmissions } = await rebuildFrequencyAnswerGroups(questionId);
  const canonicalConfig = buildFrequencyCanonicalConfig(question.canonicalGroups);

  // If the question is already revealed, calculate score immediately
  let score = 0;
  let results = null;

  if (question.status === "revealed") {
    score = calculateFrequencyScore(rawAnswers, allAnswers, totalSubmissions, canonicalConfig);
    await prisma.frequencySubmission.update({
      where: { id: submission.id },
      data: { score },
    });
    results = { answers: allAnswers, totalSubmissions };
  }

  const response = NextResponse.json({ success: true, submissionId: submission.id, score, results });

  // Set a persistent guest session cookie so the page can detect returning guests
  if (!userId && effectiveSessionId) {
    response.cookies.set('pw_freq_session', effectiveSessionId, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: 'lax',
      httpOnly: false, // readable by client-side JS for dedup pre-submit
    });
  }

  return response;
}
