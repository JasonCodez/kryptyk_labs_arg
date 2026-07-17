import { readImageDimensions, isSquareAspect } from "./imageDimensions";

function pngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  buf.writeUInt8(0x89, 0); buf.writeUInt8(0x50, 1); buf.writeUInt8(0x4e, 2); buf.writeUInt8(0x47, 3);
  buf.writeUInt8(0x0d, 4); buf.writeUInt8(0x0a, 5); buf.writeUInt8(0x1a, 6); buf.writeUInt8(0x0a, 7);
  buf.writeUInt32BE(13, 8); // IHDR chunk length
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function jpegBuffer(width: number, height: number): Buffer {
  // SOI, then an APP0 segment (harmless filler), then a SOF0 segment carrying dimensions.
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]); // length=4 (2 bytes payload)
  const sof0 = Buffer.alloc(9);
  sof0.writeUInt8(0xff, 0); sof0.writeUInt8(0xc0, 1);
  sof0.writeUInt16BE(8, 2); // segment length (excludes marker, includes itself)
  sof0.writeUInt8(8, 4); // precision
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
  buf.writeUInt32LE(10, 16); // chunk size
  // bytes 20-23 are flags/reserved, left zero
  const w = width - 1, h = height - 1;
  buf[24] = w & 0xff; buf[25] = (w >> 8) & 0xff; buf[26] = (w >> 16) & 0xff;
  buf[27] = h & 0xff; buf[28] = (h >> 8) & 0xff; buf[29] = (h >> 16) & 0xff;
  return buf;
}

describe("imageDimensions", () => {
  test("reads PNG dimensions from the IHDR chunk", () => {
    expect(readImageDimensions(pngBuffer(640, 640))).toEqual({ width: 640, height: 640 });
  });

  test("reads JPEG dimensions from the SOF0 segment", () => {
    expect(readImageDimensions(jpegBuffer(1024, 768))).toEqual({ width: 1024, height: 768 });
  });

  test("reads WebP (VP8X) dimensions", () => {
    expect(readImageDimensions(webpVp8xBuffer(800, 600))).toEqual({ width: 800, height: 600 });
  });

  test("returns null for an unrecognized buffer", () => {
    expect(readImageDimensions(Buffer.from("not an image"))).toBeNull();
  });

  test("returns null for SVG bytes (not a supported raster format)", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"></svg>');
    expect(readImageDimensions(svg)).toBeNull();
  });

  test("returns null for GIF bytes (not a supported raster format)", () => {
    // Minimal GIF87a header — signature + logical screen descriptor, dims encoded but never
    // read since GIF isn't one of the three supported formats.
    const gif = Buffer.alloc(13);
    gif.write("GIF87a", 0, "ascii");
    gif.writeUInt16LE(640, 6); // width
    gif.writeUInt16LE(640, 8); // height
    expect(readImageDimensions(gif)).toBeNull();
  });

  test("returns null for a truncated/malformed PNG (valid signature, no IHDR payload)", () => {
    const truncated = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(readImageDimensions(truncated)).toBeNull();
  });

  describe("isSquareAspect", () => {
    test("a square image is square", () => {
      expect(isSquareAspect(1024, 1024)).toBe(true);
    });

    test("a legacy non-square source is detected, not silently accepted", () => {
      expect(isSquareAspect(800, 600)).toBe(false);
    });

    test("small metadata-rounding differences are tolerated", () => {
      expect(isSquareAspect(1024, 1030)).toBe(true);
    });

    test("zero/negative dimensions are never square", () => {
      expect(isSquareAspect(0, 0)).toBe(false);
    });
  });
});
