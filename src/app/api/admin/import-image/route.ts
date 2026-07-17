import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { resolveUploadsPath } from "@/lib/uploadStorage";
import { readImageDimensions, isSquareAspect } from "@/lib/imageDimensions";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { role: true, id: true } });
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { puzzleId, imageUrl } = body || {};
    if (!puzzleId || !imageUrl) return NextResponse.json({ error: 'Missing puzzleId or imageUrl' }, { status: 400 });

    // Ensure puzzle exists and is jigsaw
    const jigsaw = await prisma.jigsawPuzzle.findUnique({ where: { puzzleId } });
    if (!jigsaw) return NextResponse.json({ error: 'Jigsaw puzzle not found for puzzleId' }, { status: 404 });

    // Validate URL
    let parsedUrl: URL;
    try { parsedUrl = new URL(imageUrl); }
    catch { return NextResponse.json({ error: 'Invalid imageUrl' }, { status: 400 }); }

    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only http/https URLs supported' }, { status: 400 });
    }

    // Fetch image server-side
    const resp = await fetch(imageUrl, { method: 'GET' });
    if (!resp.ok) return NextResponse.json({ error: 'Failed to fetch image', status: resp.status }, { status: 502 });

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return NextResponse.json({ error: 'URL did not return an image', status: 400 }, { status: 400 });

    const contentLengthHeader = resp.headers.get('content-length');
    if (contentLengthHeader) {
      const len = parseInt(contentLengthHeader, 10);
      if (!Number.isNaN(len) && len > MAX_BYTES) {
        return NextResponse.json({ error: 'Image too large' }, { status: 413 });
      }
    }

    const arrayBuffer = await resp.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'Image too large' }, { status: 413 });

    // Every jigsaw source image must be square — checked server-side (this route is jigsaw-only).
    // A file that can't be dimension-verified (GIF/SVG/corrupt — readImageDimensions only
    // recognizes PNG/JPEG/WebP) is rejected outright rather than silently allowed through.
    const dims = readImageDimensions(buf);
    if (!dims || !isSquareAspect(dims.width, dims.height)) {
      return NextResponse.json({ error: 'Jigsaw images must use a 1:1 square aspect ratio.' }, { status: 400 });
    }

    // Determine filename and extension
    const origName = path.basename(parsedUrl.pathname) || 'image';
    const ext = path.extname(origName) || (contentType.split('/')[1] ? `.${contentType.split('/')[1].split(';')[0]}` : '.jpg');
    const safeBase = origName.replace(/[^a-z0-9-_\.]/gi, '_').replace(/_+/g, '_').slice(0, 80);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;

    const uploadsDir = resolveUploadsPath('puzzles', puzzleId);
    await fs.mkdir(uploadsDir, { recursive: true });
    const outPath = path.join(uploadsDir, fileName);
    await fs.writeFile(outPath, buf);

    const publicUrl = `/uploads/puzzles/${puzzleId}/${fileName}`;

    // Update DB
    await prisma.jigsawPuzzle.update({ where: { puzzleId }, data: { imageUrl: publicUrl } });

    return NextResponse.json({ success: true, imageUrl: publicUrl });
  } catch (err) {
    console.error('admin.import-image error', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
