import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminUser } from '@/lib/requireAdmin';

// GET: List all subcategories (optionally filter by categoryId)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('categoryId');
  const where = categoryId ? { categoryId } : {};
  const subcategories = await prisma.puzzleSubcategory.findMany({
    where,
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(subcategories);
}

// POST: Create a new subcategory
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, categoryId } = await req.json();
    if (!name || !categoryId) {
      return NextResponse.json({ error: 'Name and categoryId are required.' }, { status: 400 });
    }
    const subcategory = await prisma.puzzleSubcategory.create({
      data: { name, description, categoryId },
    });
    return NextResponse.json(subcategory, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create subcategory.' }, { status: 500 });
  }
}
