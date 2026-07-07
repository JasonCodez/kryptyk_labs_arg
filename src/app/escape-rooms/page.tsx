
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminEscapeRoomsPanel from "./_AdminPanel";

export default async function EscapeRoomsPage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: (session.user as { id: string }).id },
      select: { role: true },
    });
    if (user?.role === "admin") {
      return <AdminEscapeRoomsPanel />;
    }
  }

  // Not yet released to players.
  redirect("/puzzles");
}
