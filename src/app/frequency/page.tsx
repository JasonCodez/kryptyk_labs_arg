import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FrequencyGame from "@/components/FrequencyGame";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Frequency | PuzzleWarz" };

export default async function FrequencyPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id ?? null;
  const isGuest = !userId;

  const cookieStore = await cookies();
  const guestSessionId = cookieStore.get('pw_freq_session')?.value ?? null;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Look back 1 UTC day so that users in negative-offset timezones (e.g. UTC-5
  // where midnight hasn't hit yet) still see the question they scheduled for
  // their "today" even after UTC has already rolled over to the next day.
  const yesterday = new Date(today.getTime() - 86_400_000);

  const question = await prisma.frequencyQuestion.findFirst({
    where: { scheduledFor: { gte: yesterday, lte: today } },
    orderBy: { scheduledFor: "desc" },
    select: { id: true, question: true, status: true, scheduledFor: true, canonicalGroups: true },
  });

  let alreadySubmitted = false;
  let existingSubmission = null;
  let results = null;

  if (question) {
    if (userId) {
      existingSubmission = await prisma.frequencySubmission.findUnique({
        where: { questionId_userId: { questionId: question.id, userId } },
        select: { answers: true, score: true },
      });
      alreadySubmitted = !!existingSubmission;
    } else if (guestSessionId) {
      // Check if guest already submitted via their session cookie
      const guestExisting = await prisma.frequencySubmission.findFirst({
        where: { questionId: question.id, sessionId: guestSessionId },
        select: { answers: true, score: true },
      });
      if (guestExisting) {
        alreadySubmitted = true;
        existingSubmission = guestExisting as { answers: string[]; score: number };
      }
    }

    if (question.status === "revealed") {
      const answers = await prisma.frequencyAnswer.findMany({
        where: { questionId: question.id },
        orderBy: { count: "desc" },
        select: { id: true, displayText: true, text: true, count: true },
      });
      const totalSubmissions = await prisma.frequencySubmission.count({
        where: { questionId: question.id },
      });
      results = { answers, totalSubmissions };
    }
  }

  return (
    <>
      <main className="min-h-screen pt-24 pb-10 px-4" style={{ backgroundColor: "#020202" }}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-4xl mb-2">📡</p>
          <h1 className="text-3xl font-black text-white tracking-tight">FREQUENCY</h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            Think like the crowd. Score = how many people agreed with you.
          </p>
        </div>

        <FrequencyGame
          question={question
            ? {
                ...question,
                scheduledFor: question.scheduledFor.toISOString(),
              }
            : null}
          alreadySubmitted={alreadySubmitted}
          existingSubmission={existingSubmission as { answers: string[]; score: number } | null}
          initialResults={results}
          sessionId={guestSessionId}
          isGuest={isGuest}
        />
      </div>
      </main>
    </>
  );
}
