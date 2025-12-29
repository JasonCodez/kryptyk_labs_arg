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
    const file = formData.get("file") as File;
    const puzzleId = formData.get("puzzleId") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!puzzleId) {
      return NextResponse.json(
        { error: "Puzzle ID required" },
        { status: 400 }
      );
    }

    // Verify puzzle exists
    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: { id: true },
    });

    if (!puzzle) {
      return NextResponse.json(
        { error: "Puzzle not found" },
        { status: 404 }
      );
    }

    // Validate file size
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    const mimeType = getMimeType(file);
    const mediaType = getMediaType(mimeType);

    // Validate file type
    const allowedMimes = Object.values(ALLOWED_TYPES).flat();
    if (!allowedMimes.includes(mimeType)) {
      return NextResponse.json(
        { error: `File type not allowed: ${mimeType}` },
        { status: 400 }
      );
    }

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), "public", "uploads", "media");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = file.name.substring(file.name.lastIndexOf(".")) || ".bin";
    const fileName = `${puzzleId}-${timestamp}-${random}${ext}`;
    const filePath = join(uploadDir, fileName);

    // Save file
    await writeFile(filePath, Buffer.from(buffer));

    // Store media metadata in database
    const media = await prisma.puzzleMedia.create({
      data: {
        puzzleId,
        type: mediaType,
        url: `/uploads/media/${fileName}`,
        fileName: file.name,
        fileSize: buffer.byteLength,
        mimeType,
        uploadedBy: user.id,
      },
    });

    return NextResponse.json(media, { status: 201 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
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
      const fileName = media.url.split("/").pop();
      const filePath = join(process.cwd(), "public", "uploads", "media", fileName || "");
      const fs = await import("fs").then((m) => m.promises);
      await fs.unlink(filePath).catch(() => {
        // File might not exist, that's okay
      });
    } catch (err) {
      console.error("Error deleting file:", err);
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
