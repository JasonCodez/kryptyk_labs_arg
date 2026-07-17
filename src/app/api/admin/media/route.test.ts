import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { POST } from "./route";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    puzzle: { findUnique: jest.fn() },
    puzzleMedia: { create: jest.fn(), update: jest.fn() },
    jigsawPuzzle: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

const mockedGetServerSession = getServerSession as jest.Mock;
const db = prisma as unknown as {
  user: { findUnique: jest.Mock };
  puzzle: { findUnique: jest.Mock };
  puzzleMedia: { create: jest.Mock; update: jest.Mock };
  jigsawPuzzle: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
};

function pngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  buf.writeUInt8(0x89, 0); buf.writeUInt8(0x50, 1); buf.writeUInt8(0x4e, 2); buf.writeUInt8(0x47, 3);
  buf.writeUInt8(0x0d, 4); buf.writeUInt8(0x0a, 5); buf.writeUInt8(0x1a, 6); buf.writeUInt8(0x0a, 7);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function jpegBuffer(width: number, height: number): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]);
  const sof0 = Buffer.alloc(9);
  sof0.writeUInt8(0xff, 0); sof0.writeUInt8(0xc0, 1);
  sof0.writeUInt16BE(8, 2);
  sof0.writeUInt8(8, 4);
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0]);
}

function webpVp8xBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(22, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8X", 12, "ascii");
  buf.writeUInt32LE(10, 16);
  const w = width - 1, h = height - 1;
  buf[24] = w & 0xff; buf[25] = (w >> 8) & 0xff; buf[26] = (w >> 16) & 0xff;
  buf[27] = h & 0xff; buf[28] = (h >> 8) & 0xff; buf[29] = (h >> 16) & 0xff;
  return buf;
}

function gifBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(13);
  buf.write("GIF87a", 0, "ascii");
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"></svg>');

function mockFetchOnce(buffer: Buffer, contentType: string) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null) },
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  });
}

function importRequest(puzzleId: string | null, url: string) {
  const formData = new FormData();
  if (puzzleId) formData.append("puzzleId", puzzleId);
  formData.append("url", url);
  return new NextRequest("http://localhost/api/admin/media", { method: "POST", body: formData });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  mockedGetServerSession.mockResolvedValue({ user: { email: "admin@example.test" } });
  db.user.findUnique.mockResolvedValue({ id: "admin-1", role: "admin" });
  db.puzzle.findUnique.mockResolvedValue({ id: "jigsaw-puzzle-1", puzzleType: "jigsaw" });
  db.puzzleMedia.create.mockResolvedValue({ id: "media-1", url: "https://example.test/image.png" });
  db.puzzleMedia.update.mockResolvedValue({});
  db.jigsawPuzzle.findUnique.mockResolvedValue({ puzzleId: "jigsaw-puzzle-1" });
  db.jigsawPuzzle.update.mockResolvedValue({});
  db.jigsawPuzzle.create.mockResolvedValue({});
});

describe("POST /api/admin/media — jigsaw square-image validation (external URL import)", () => {
  test("accepts a square PNG", async () => {
    mockFetchOnce(pngBuffer(640, 640), "image/png");
    const response = await POST(importRequest("jigsaw-puzzle-1", "https://example.test/image.png"));
    expect(response.status).toBe(201);
  });

  test("accepts a square JPEG", async () => {
    mockFetchOnce(jpegBuffer(1024, 1024), "image/jpeg");
    const response = await POST(importRequest("jigsaw-puzzle-1", "https://example.test/image.jpg"));
    expect(response.status).toBe(201);
  });

  test("accepts a square WebP", async () => {
    mockFetchOnce(webpVp8xBuffer(800, 800), "image/webp");
    const response = await POST(importRequest("jigsaw-puzzle-1", "https://example.test/image.webp"));
    expect(response.status).toBe(201);
  });

  test("rejects a non-square image", async () => {
    mockFetchOnce(pngBuffer(800, 600), "image/png");
    const response = await POST(importRequest("jigsaw-puzzle-1", "https://example.test/image.png"));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Jigsaw images must use a 1:1 square aspect ratio.");
  });

  test("rejects an SVG (not dimension-verifiable)", async () => {
    mockFetchOnce(svgBuffer, "image/svg+xml");
    const response = await POST(importRequest("jigsaw-puzzle-1", "https://example.test/image.svg"));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Jigsaw images must use a 1:1 square aspect ratio.");
  });

  test("rejects a GIF (not dimension-verifiable)", async () => {
    mockFetchOnce(gifBuffer(640, 640), "image/gif");
    const response = await POST(importRequest("jigsaw-puzzle-1", "https://example.test/image.gif"));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Jigsaw images must use a 1:1 square aspect ratio.");
  });

  test("rejects a malformed/truncated image", async () => {
    mockFetchOnce(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png");
    const response = await POST(importRequest("jigsaw-puzzle-1", "https://example.test/image.png"));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Jigsaw images must use a 1:1 square aspect ratio.");
  });

  test("a temporary (no puzzleId) upload of a non-square image succeeds — intent can't be validated without a puzzle — but re-importing that same image to a real jigsaw puzzle is still rejected", async () => {
    mockFetchOnce(pngBuffer(800, 600), "image/png");
    const temp = await POST(importRequest(null, "https://example.test/nonsquare.png"));
    expect(temp.status).toBe(201);
    expect(db.puzzle.findUnique).not.toHaveBeenCalled();

    mockFetchOnce(pngBuffer(800, 600), "image/png");
    const attach = await POST(importRequest("jigsaw-puzzle-1", "https://example.test/nonsquare.png"));
    expect(attach.status).toBe(400);
    const json = await attach.json();
    expect(json.error).toBe("Jigsaw images must use a 1:1 square aspect ratio.");
  });
});
