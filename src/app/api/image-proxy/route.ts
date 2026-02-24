import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { resolveUploadsPath } from '@/lib/uploadStorage';

export const runtime = 'nodejs';

// Simple image proxy for puzzles to avoid CORS blocking when images are hosted
// on third-party hosts. SECURITY: restrict allowed hosts via ALLOWED_IMAGE_HOSTS
// env var (comma-separated). If unset, only allow same-origin (relative URLs).

const ALLOWED = (() => {
  const hosts = process.env.ALLOWED_IMAGE_HOSTS
    ? process.env.ALLOWED_IMAGE_HOSTS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  // Auto-allow the configured R2 public URL host so uploaded media can be proxied
  if (process.env.R2_PUBLIC_URL) {
    try {
      const r2Host = new URL(process.env.R2_PUBLIC_URL).hostname;
      if (r2Host && !hosts.includes(r2Host)) hosts.push(r2Host);
    } catch { /* ignore bad URL */ }
  }
  return hosts.length > 0 ? hosts : null;
})();

function contentTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.avif':
      return 'image/avif';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.ogg':
      return 'video/ogg';
    case '.mp3':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
}

function getRequestOrigin(req: Request): string {
  // Prefer proxy headers (Render/NGINX/etc) so relative URL resolution is stable.
  const xfProto = req.headers.get('x-forwarded-proto');
  const xfHost = req.headers.get('x-forwarded-host');
  if (xfProto && xfHost) return `${xfProto}://${xfHost}`;
  return new URL(req.url).origin;
}

function decodePathParts(raw: string): string[] {
  return raw
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === 'object' && err !== null && 'code' in err;
}

function hostAllowed(allowed: string[], hostname: string) {
  const h = hostname.toLowerCase();
  for (const raw of allowed) {
    const rule = raw.toLowerCase();
    if (!rule) continue;
    if (rule === h) return true;
    // Support wildcard subdomains: *.example.com or **.example.com
    const suffix = rule.startsWith('*.') ? rule.slice(1) : rule.startsWith('**.') ? rule.slice(2) : null;
    if (suffix && suffix.length > 1 && h.endsWith(suffix)) return true;
  }
  return false;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const target = url.searchParams.get('url');
    if (!target) return NextResponse.json({ error: 'missing url' }, { status: 400 });

    // Fast-path: same-origin uploaded files — avoid HTTP self-fetch (can break behind proxies)
    if (target.startsWith('/uploads/')) {
      const rel = target.slice('/uploads/'.length);
      const parts = decodePathParts(rel);
      try {
        const filePath = resolveUploadsPath(...parts);
        const buf = await readFile(filePath);
        return new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type': contentTypeForFile(filePath),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (err) {
        if (isNodeError(err) && err.code && err.code !== 'ENOENT') {
          console.error('[image-proxy] failed reading uploads file', { target, code: err.code });
          return NextResponse.json({ error: 'internal' }, { status: 500 });
        }
        return NextResponse.json({ error: 'not found' }, { status: 404 });
      }
    }

    if (target.startsWith('/content/images/')) {
      const rel = target.slice('/content/images/'.length);
      const parts = decodePathParts(rel);
      try {
        const filePath = resolveUploadsPath('content', 'images', ...parts);
        const buf = await readFile(filePath);
        return new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type': contentTypeForFile(filePath),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (err) {
        if (isNodeError(err) && err.code && err.code !== 'ENOENT') {
          console.error('[image-proxy] failed reading content image file', { target, code: err.code });
          return NextResponse.json({ error: 'internal' }, { status: 500 });
        }
        return NextResponse.json({ error: 'not found' }, { status: 404 });
      }
    }

    // ensure http/https or same-origin-relative
    if (!/^https?:\/\//i.test(target) && !target.startsWith('/')) {
      return NextResponse.json({ error: 'invalid url' }, { status: 400 });
    }

    const requestOrigin = getRequestOrigin(req);
    const resolvedUrl = new URL(target, requestOrigin).toString();
    const resolved = new URL(resolvedUrl);
    const isSameOrigin = resolved.origin === requestOrigin;

    // If allowlist is configured, validate the hostname
    if (ALLOWED) {
      // Always allow same-origin assets (e.g. /uploads/*) regardless of allowlist.
      if (!isSameOrigin && !hostAllowed(ALLOWED, resolved.hostname)) {
        return NextResponse.json({ error: 'host not allowed' }, { status: 403 });
      }
    } else if (/^https?:\/\//i.test(target)) {
      // no allowlist and target is absolute -> block for safety in production
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'proxying remote hosts is disabled (set ALLOWED_IMAGE_HOSTS)' }, { status: 403 });
      }
      // allow in development for easier testing (beware security risks)
    }

    // Use native fetch on server
    const resp = await fetch(resolvedUrl, { method: 'GET', cache: 'force-cache' });
    if (!resp.ok) return NextResponse.json({ error: 'fetch failed', status: resp.status }, { status: 502 });

    const contentType = resp.headers.get('content-type') || 'application/octet-stream';

    // For streaming media (video/audio), redirect the browser to the source URL directly.
    // Buffering video through this proxy kills HTTP range-request support, causing choppy playback.
    // <video> elements don't send CORS preflights (no crossOrigin attr), so redirecting is safe.
    if (/^(video|audio)\//.test(contentType) || /\.(mp4|webm|mov|avi|ogg|mp3|wav|aac)$/i.test(resolvedUrl.split(/[?#]/)[0])) {
      return NextResponse.redirect(resolvedUrl, { status: 302 });
    }

    const body = await resp.arrayBuffer();

    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('image-proxy error', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
