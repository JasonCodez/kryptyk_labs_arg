import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    // Required fields: puzzleId, roomTitle, roomDescription, minTeamSize, maxTeamSize
    const { puzzleId, roomTitle, roomDescription, minTeamSize, maxTeamSize, timeLimitSeconds } = data;
    if (!puzzleId || !roomTitle || !roomDescription || !minTeamSize || !maxTeamSize) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const createData: any = {
      puzzleId,
      roomTitle,
      roomDescription,
    };

    if (typeof minTeamSize !== 'undefined' && minTeamSize !== null) createData.minTeamSize = Number(minTeamSize);
    if (typeof maxTeamSize !== 'undefined' && maxTeamSize !== null) createData.maxTeamSize = Number(maxTeamSize);
    if (typeof timeLimitSeconds !== 'undefined' && timeLimitSeconds !== null) createData.timeLimitSeconds = Number(timeLimitSeconds);

    const escapeRoom = await prisma.escapeRoomPuzzle.create({
      data: createData,
    });
    return NextResponse.json({ escapeRoom }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({ error: errorMessage, stack: errorStack }, { status: 500 });
  }
}
