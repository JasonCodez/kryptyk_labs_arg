import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Max file sizes (in bytes)
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB for video
const ALLOWED_TYPES = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
  video: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
  audio: ["audio/mpeg", "audio/wav", "audio/webm", "audio/ogg"],
  document: ["application/pdf", "text/plain", "application/msword"],
};

const TYPE_EXTENSIONS: Record<string, string[]> = {
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
  video: [".mp4", ".webm", ".mov", ".avi"],
  audio: [".mp3", ".wav", ".webm", ".ogg"],
  document: [".pdf", ".txt", ".doc", ".docx"],
};

function getMimeType(file: File): string {
  return file.type || "application/octet-stream";
}

function getMediaType(mimeType: string): string {
  for (const [type, mimes] of Object.entries(ALLOWED_TYPES)) {
    if ((mimes as string[]).includes(mimeType)) {
      return type;
    }
  }
  return "file";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const puzzleIdRaw = formData.get("puzzleId") as string | null;
    const puzzleId = puzzleIdRaw || undefined;
    const externalUrl = (formData.get("url") as string) || null;

    if (!file && !externalUrl) {
      return NextResponse.json(
        { error: "No file or URL provided" },
        { status: 400 }
      );
    }


    // If puzzleId is provided, verify puzzle exists. If not, allow as unattached/temporary media.
    let puzzle = null;
    if (puzzleId) {
      puzzle = await prisma.puzzle.findUnique({
        where: { id: puzzleId },
        select: { id: true, puzzleType: true },
      });
      if (!puzzle) {
        return NextResponse.json(
          { error: "Puzzle not found" },
          { status: 404 }
        );
      }
    }

    // We'll support two modes:
    // 1) a direct file upload (form `file`)
    // 2) an external URL (form `url`) — we fetch the remote resource, validate it,
    //    and store the external URL in the DB (no disk write).

    let buffer: ArrayBuffer | null = null;
    let mimeType = "application/octet-stream";
    let mediaType = "file";
    let fileName = "";
    let fileSize = 0;
    let mediaUrl = "";

    if (file) {
      // File upload path (existing behavior)
      buffer = await file.arrayBuffer();
      if (buffer.byteLength > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
          { status: 400 }
        );
      }

      mimeType = getMimeType(file);
      mediaType = getMediaType(mimeType);

      console.log(`[MEDIA UPLOAD] File received: ${file.name}, mime: ${mimeType}, mediaType: ${mediaType}`);

      // Validate file type
      const allowedMimes = Object.values(ALLOWED_TYPES).flat();
      if (!allowedMimes.includes(mimeType)) {
        console.log(`[MEDIA UPLOAD] File type not allowed: ${mimeType}`);
        return NextResponse.json(
          { error: `File type not allowed: ${mimeType}` },
          { status: 400 }
        );
      }

      // Allow caller to request alternate storage locations for specific use-cases
      // (e.g. designer background images). Only allow whitelisted targets.
      const dest = (formData.get('dest') as string) || '';
      const ALLOWED_DESTS: Record<string, { dir: string; urlPrefix: string }> = {
        'uploads-media': { dir: join(process.cwd(), 'public', 'uploads', 'media'), urlPrefix: '/uploads/media' },
        'content-images': { dir: join(process.cwd(), 'public', 'content', 'images'), urlPrefix: '/content/images' },
      };

      const chosen = ALLOWED_DESTS[dest || 'uploads-media'] || ALLOWED_DESTS['uploads-media'];

      // Create upload directory if it doesn't exist
      const uploadDir = chosen.dir;
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      // Generate unique filename and save to disk
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const ext = file.name.substring(file.name.lastIndexOf('.') ) || '.bin';
      const uniqueFileName = `${puzzleId || 'temp'}-${timestamp}-${random}${ext}`;
      const filePath = join(uploadDir, uniqueFileName);

      await writeFile(filePath, Buffer.from(buffer));

      fileName = file.name;
      fileSize = buffer.byteLength;
      mediaUrl = `${chosen.urlPrefix}/${uniqueFileName}`;
    } else if (externalUrl) {
      // External URL path — fetch the remote resource and validate
      try {
        new URL(externalUrl);
      } catch (err) {
        return NextResponse.json({ error: "Invalid URL provided" }, { status: 400 });
      }

      const res = await fetch(externalUrl);
      if (!res.ok) {
        return NextResponse.json({ error: "Failed to fetch external URL" }, { status: 400 });
      }

      const arr = await res.arrayBuffer();
      buffer = arr;
      fileSize = arr.byteLength;
      if (fileSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Remote file too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
          { status: 400 }
        );
      }

      mimeType = (res.headers.get("content-type") || "application/octet-stream").split(";")[0];
      mediaType = getMediaType(mimeType);

      // Validate file type
      const allowedMimes = Object.values(ALLOWED_TYPES).flat();
      if (!allowedMimes.includes(mimeType)) {
        console.log(`[MEDIA UPLOAD] External URL file type not allowed: ${mimeType}`);
        return NextResponse.json(
          { error: `File type not allowed: ${mimeType}` },
          { status: 400 }
        );
      }

      // Attempt to infer filename from URL
      try {
        const parsed = new URL(externalUrl);
        const parts = parsed.pathname.split("/").filter(Boolean);
        fileName = parts.length ? decodeURIComponent(parts[parts.length - 1]) : parsed.hostname;
      } catch (e) {
        fileName = externalUrl;
      }

      mediaUrl = externalUrl; // store external URL directly (no disk write)
      console.log(`[MEDIA UPLOAD] External URL used: ${mediaUrl}, mime: ${mimeType}, size: ${fileSize}`);
    }

    // Store media metadata in database

    const createData: any = {
      type: mediaType,
      url: mediaUrl,
      fileName: fileName || (file ? file.name : ""),
      fileSize: fileSize,
      mimeType,
      uploadedBy: user.id,
    };

    if (puzzleId) {
      createData.puzzleId = puzzleId;
    }

    const media = await prisma.puzzleMedia.create({
      data: createData,
    });

    // Some generated Prisma client types may not include the `temporary` field
    // (for example if the client wasn't regenerated). Set `temporary` in a
    // follow-up update when there is no `puzzleId` so the DB reflects the
    // intended transient state without relying on the create input type.
    if (!puzzleId) {
      try {
        const updateData: any = { temporary: true };
        await prisma.puzzleMedia.update({
          where: { id: media.id },
          data: updateData,
        });
        // reflect update in `media` variable for response
        (media as any).temporary = true;
      } catch (err) {
        console.warn('[MEDIA UPLOAD] Failed to mark media as temporary:', err);
      }
    }

    console.log(`[MEDIA UPLOAD] Media created: ${media.id}, type: ${mediaType}, url: ${media.url}`);

    // If this is a jigsaw puzzle, auto-wire the first uploaded image as the puzzle image.
    if (puzzle && puzzle.puzzleType === 'jigsaw' && mediaType === 'image') {
      console.log(`[MEDIA UPLOAD] Processing jigsaw image for puzzle: ${puzzleId}`);
      console.log(`[MEDIA UPLOAD] Setting imageUrl to: ${media.url}`);
      try {
        // First check if jigsaw exists
        const existingJigsaw = await prisma.jigsawPuzzle.findUnique({
          where: { puzzleId: puzzleId as string },
        });
        console.log(`[MEDIA UPLOAD] Existing jigsaw record:`, JSON.stringify(existingJigsaw, null, 2));
        if (!existingJigsaw) {
          console.log(`[MEDIA UPLOAD] Jigsaw record not found, creating...`);
          const createdJigsaw = await prisma.jigsawPuzzle.create({
            data: {
              puzzleId: puzzleId as string,
              imageUrl: media.url,
              gridRows: 3,
              gridCols: 4,
              snapTolerance: 12,
              rotationEnabled: false,
            },
          });
          console.log(`[MEDIA UPLOAD] Created jigsaw with imageUrl:`, createdJigsaw.imageUrl);
        } else {
          console.log(`[MEDIA UPLOAD] Jigsaw exists, updating imageUrl...`);
          const updatedJigsaw = await prisma.jigsawPuzzle.update({
            where: { puzzleId: puzzleId as string },
            data: {
              imageUrl: media.url,
            },
          });
          console.log(`[MEDIA UPLOAD] Updated jigsaw, imageUrl now:`, updatedJigsaw.imageUrl);
        }
        // Verify it was updated
        const verifyJigsaw = await prisma.jigsawPuzzle.findUnique({
          where: { puzzleId: puzzleId as string },
        });
        console.log(`[MEDIA UPLOAD] Verification - jigsaw imageUrl: ${verifyJigsaw?.imageUrl}`);
      } catch (err) {
        console.error('[MEDIA UPLOAD] Failed to update jigsaw imageUrl:', err);
        throw err; // Re-throw to notify client
      }
    } else if (puzzle) {
      console.log(`[MEDIA UPLOAD] Skipping jigsaw update: puzzleType=${puzzle.puzzleType}, mediaType=${mediaType}`);
    } else {
      console.log(`[MEDIA UPLOAD] No puzzleId provided, skipping jigsaw logic.`);
    }

    // Always return mediaUrl for frontend compatibility
    return NextResponse.json({ ...media, mediaUrl: media.url }, { status: 201 });
  } catch (error) {
    console.error("Error uploading file:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("id");

    if (!mediaId) {
      return NextResponse.json(
        { error: "Media ID required" },
        { status: 400 }
      );
    }

    // Delete from database
    const media = await prisma.puzzleMedia.delete({
      where: { id: mediaId },
    });

    // Delete file from filesystem
    try {
      if (media && media.url) {
        const fileName = media.url.split("/").pop();
        const filePath = join(process.cwd(), "public", "uploads", "media", fileName || "");
        const fs = await import("fs").then((m: any) => m.promises);
        await fs.unlink(filePath).catch(() => {
          // File might not exist, that's okay
        });
      } else {
        console.warn('Media has no URL, skipping filesystem delete');
      }
    } catch (fileError) {
      console.error("Error deleting file:", fileError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting media:", error);
    return NextResponse.json(
      { error: "Failed to delete media" },
      { status: 500 }
    );
  }
}
