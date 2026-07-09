import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminUser } from "@/lib/requireAdmin";

// GET /api/admin/bug-reports — list bug reports with optional ?status= filter
export async function GET(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending";

  const reports = await prisma.bugReport.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true } },
      puzzle: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(reports);
}

// PATCH /api/admin/bug-reports — update a report's status
export async function PATCH(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { id, status } = body;

  if (!id || !["reviewed", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.bugReport.update({
    where: { id },
    data: { status, reviewedAt: new Date(), reviewedBy: admin.id },
  });

  return NextResponse.json(updated);
}
