import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveLevelUpSpins } from "@/lib/slotMachine/resolveLevelUpSpins";

/**
 * POST /api/user/claim-level-reward
 *
 * Called opportunistically (poll + puzzle-solved event) to resolve any pending
 * level-up slot spins. Idempotent — concurrent or repeated calls are safe; only the
 * first resolves and grants each unclaimed level's spin.
 *
 * Response: { spins: SlotSpinResult[] | null }
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const spins = await resolveLevelUpSpins(user.id);
  return NextResponse.json({ spins });
}
