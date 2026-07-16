// Reads pixel dimensions directly from an image file's binary header, without any image
// processing library or native dependency (there's no `sharp`/`image-size` etc. wired into
// this repo's upload path today, and this repo's uploads run in serverless/edge-adjacent
// environments where a native binary dependency has real cold-start/deployment cost). Only
// the three raster formats a jigsaw source image would realistically be are supported —
// PNG, JPEG, and WebP. Unsupported/unrecognized formats return null (callers should treat
// that as "couldn't verify," not as a rejection).

export interface ImageDimensions {
  width: number;
  height: number;
}

export function readImageDimensions(buffer: Buffer): ImageDimensions | null {
  return readPngDimensions(buffer) ?? readJpegDimensions(buffer) ?? readWebpDimensions(buffer);
}

export function isSquareAspect(width: number, height: number, tolerance = 0.02): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  return Math.abs(width / height - 1) <= tolerance;
}

// PNG: 8-byte signature, then an IHDR chunk (4-byte length + "IHDR" + 4-byte width + 4-byte
// height, all big-endian) always comes first.
function readPngDimensions(buf: Buffer): ImageDimensions | null {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (buf[i] !== PNG_SIGNATURE[i]) return null;
  }
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// JPEG: walk the marker segments after the SOI (0xFFD8) until a Start-Of-Frame marker
// (0xC0-0xCF, excluding 0xC4/0xC8/0xCC which aren't frame markers) — its payload's first two
// bytes are precision, then height, then width (all big-endian).
function readJpegDimensions(buf: Buffer): ImageDimensions | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) { offset += 1; continue; }
    const marker = buf[offset + 1];
    // Standalone markers with no following length/payload.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      if (marker === 0xd9) return null; // EOI reached without finding a SOF
      offset += 2;
      continue;
    }
    if (offset + 4 > buf.length) return null;
    const length = buf.readUInt16BE(offset + 2);
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      if (offset + 9 > buf.length) return null;
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    if (marker === 0xda) return null; // Start-of-Scan reached without finding a SOF
    offset += 2 + length;
  }
  return null;
}

// WebP: a RIFF container ("RIFF" + size + "WEBP"), then one chunk of VP8 (lossy), VP8L
// (lossless), or VP8X (extended, carries its own explicit canvas size) — each encodes
// dimensions differently.
function readWebpDimensions(buf: Buffer): ImageDimensions | null {
  if (buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const format = buf.toString("ascii", 12, 16);
  if (format === "VP8 ") {
    // Lossy: 3-byte frame tag + 3-byte sync code, then two 16-bit little-endian values,
    // each with a 2-bit scale prefix in the top bits.
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (format === "VP8L") {
    if (buf[20] !== 0x2f) return null; // lossless signature byte
    const bits = buf.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (format === "VP8X") {
    // 24-bit little-endian width/height, stored minus one, at fixed offsets.
    const width = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
    const height = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
    return { width, height };
  }
  return null;
}
